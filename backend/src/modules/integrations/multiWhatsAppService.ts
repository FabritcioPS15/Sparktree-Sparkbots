import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  proto
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { supabase } from '../../core/config/supabase';
import { handleIncomingMessage } from '../bots/engine/flow-core';
import { sessionPersistenceService } from './sessionPersistenceService';
import { messageQueueService } from '../../shared/services/messageQueueService';
import { io } from '../../api';

interface WhatsAppConnection {
  id: string;
  userId: string;
  organizationId: string;
  displayName: string;
  phoneNumber?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  socket?: any;
  qr?: string;
  authStatePath?: string;
  lastConnectedAt?: Date;
}

export class MultiWhatsAppService {
  private connections: Map<string, WhatsAppConnection> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private logger = pino({ level: 'silent' });
  private readonly MAX_RECONNECT_ATTEMPTS = 10;

  // Initialize all connections in the database (for server startup)
  async initializeAllConnections() {
    console.log('\x1b[36m📱 [WhatsApp]\x1b[0m Iniciando conexiones guardadas...');
    const { data: connections, error } = await supabase
      .from('whatsapp_connections')
      .select('*');

    if (error) {
      console.error('Error fetching all connections:', error);
      return;
    }

    // Initialize in parallel to avoid one hang blocking others
    await Promise.allSettled((connections || []).map(conn => this.initializeConnection(conn)));

    // Start health check every 60 seconds for dormant connections
    this.startHealthCheck();
  }

  private startHealthCheck() {
    setInterval(async () => {
      for (const [id, conn] of this.connections) {
        if (conn.status === 'error' && !conn.socket) {
          console.log(`[MultiWhatsApp] Health check: reintentando conexión ${conn.displayName}...`);
          try {
            await this.connectSocket(conn);
          } catch (err) {
            console.error(`[MultiWhatsApp] Health check falló para ${id}:`, err);
          }
        }
      }
    }, 60000);
  }

  // Initialize all connections for a user
  async initializeUserConnections(userId: string) {
    const { data: connections, error } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user connections:', error);
      return;
    }

    for (const conn of connections || []) {
      await this.initializeConnection(conn);
    }
  }

  // Initialize a single connection
  async initializeConnection(connectionData: any) {
    // Use ephemeral directory for auth state (RNF-05)
    const authStatePath = path.join(process.env.AUTH_STATE_PATH || '/tmp/auth_state', `auth_info_${connectionData.id}`);

    const connection: WhatsAppConnection = {
      id: connectionData.id,
      userId: connectionData.user_id,
      organizationId: connectionData.organization_id,
      displayName: connectionData.display_name,
      phoneNumber: connectionData.phone_number,
      status: 'disconnected',
      authStatePath
    };

    this.connections.set(connectionData.id, connection);

    // Formato amigable para los logs
    const phoneInfo = connection.phoneNumber ? ` (${connection.phoneNumber})` : '';
    const connLabel = `${connection.displayName || 'Desconocido'}${phoneInfo} [${connection.id.substring(0, 8)}]`;

    // Try to restore session from database first (RF-04)
    const sessionRestored = await sessionPersistenceService.restoreSessionToLocal(
      connection.id,
      authStatePath
    );

    if (sessionRestored) {
      console.log(`\x1b[32m✅ [WhatsApp]\x1b[0m Sesión existente encontrada para ${connLabel}, conectando...`);
      await this.connectSocket(connection);
    } else {
      console.log(`\x1b[2m   ↳ [WhatsApp] Esperando conexión manual (QR) para ${connLabel}\x1b[0m`);
    }
  }

  // Force start a connection (e.g. to get a QR code)
  async startConnection(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) throw new Error('Conexión no encontrada');

    // If already connected, do nothing
    if (connection.status === 'connected' && connection.socket) return;

    await this.connectSocket(connection);
  }

  // Create new WhatsApp connection for user
  async createConnection(userId: string, displayName: string) {
    // Get organization ID and limit from organization
    const { data: orgUser, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (userError || !orgUser) {
      throw new Error('Usuario no encontrado en organización');
    }

    // Check connection limit from organization
    const { data: org } = await supabase
      .from('organizations')
      .select('max_whatsapp_connections')
      .eq('id', orgUser.organization_id)
      .single();

    const connectionsLimit = org?.max_whatsapp_connections ?? 3;

    // Count current connections
    const { count: activeConnections } = await supabase
      .from('whatsapp_connections')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgUser.organization_id);

    if ((activeConnections ?? 0) >= connectionsLimit) {
      throw new Error('Has alcanzado tu límite de conexiones WhatsApp');
    }

    // Create connection record
    const { data: connection, error } = await supabase
      .from('whatsapp_connections')
      .insert({
        user_id: userId,
        organization_id: orgUser.organization_id,
        display_name: displayName,
        status: 'disconnected'
      })
      .select()
      .single();

    if (error) {
      throw new Error('Error creando conexión: ' + error.message);
    }

    await this.initializeConnection(connection);
    return connection;
  }


  // Connect socket for a specific connection
  private async connectSocket(connection: WhatsAppConnection) {
    try {
      if (!connection.authStatePath) {
        throw new Error('Auth state path not defined');
      }

      if (connection.status === 'connected' && connection.socket) {
        console.log(`[MultiWhatsApp] Already connected for ${connection.id}.`);
        return;
      }

      console.log(`[MultiWhatsApp] Connecting socket for ${connection.id}...`);

      // Try to restore session from database first
      const sessionRestored = await sessionPersistenceService.restoreSessionToLocal(
        connection.id,
        connection.authStatePath
      );

      if (sessionRestored) {
        console.log(`[MultiWhatsApp] Session restored from database for ${connection.id}`);
      } else {
        console.log(`[MultiWhatsApp] No session found in database, starting fresh for ${connection.id}`);
      }

      const { state, saveCreds } = await useMultiFileAuthState(connection.authStatePath);

      let version: any = [2, 3000, 1015901307]; // Fallback version
      try {
        console.log('[MultiWhatsApp] Fetching latest Baileys version...');
        // Timeout after 5s to avoid hanging the whole service
        const latestPromise = fetchLatestBaileysVersion();
        const latest = await Promise.race([
          latestPromise,
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Version fetch timeout')), 5000))
        ]);
        version = latest.version;
        console.log(`[MultiWhatsApp] Using Baileys version: ${version}`);
      } catch (err) {
        console.warn('[MultiWhatsApp] Failed to fetch latest Baileys version, using fallback:', err);
      }

      connection.socket = makeWASocket({
        version,
        printQRInTerminal: false,
        auth: state,
        logger: this.logger,
        defaultQueryTimeoutMs: 60000,
        connectTimeoutMs: 60000,
      });

      connection.status = 'connecting';

      connection.socket.ev.on('creds.update', async () => {
        console.log(`[MultiWhatsApp] Creds updated for ${connection.id}`);
        await saveCreds();

        // Save session to database after credential update
        try {
          if (connection.authStatePath) {
            const authState = this.readAuthState(connection.authStatePath);
            await sessionPersistenceService.saveSession(
              connection.id,
              connection.organizationId,
              authState,
              {
                phoneNumber: connection.phoneNumber,
              }
            );
          }
        } catch (error) {
          console.error(`[MultiWhatsApp] Error saving session to database:`, error);
        }
      });

      connection.socket.ev.on('connection.update', (update: any) => {
        const { connection: connStatus, lastDisconnect, qr } = update;

        if (qr) {
          console.log(`[MultiWhatsApp] QR Code received for connection ${connection.id}`);
          connection.qr = qr;
          connection.status = 'connecting';
          this.updateConnectionStatus(connection.id, 'connecting', qr);
        }

        if (connStatus === 'close') {
          const isLoggedOut = (lastDisconnect?.error as Boom)?.output?.statusCode === DisconnectReason.loggedOut;
          const shouldReconnect = !isLoggedOut;
          connection.status = isLoggedOut ? 'disconnected' : 'error';
          connection.qr = undefined;
          this.updateConnectionStatus(connection.id, isLoggedOut ? 'disconnected' : 'error');

          if (shouldReconnect) {
            const attempts = (this.reconnectAttempts.get(connection.id) || 0) + 1;
            this.reconnectAttempts.set(connection.id, attempts);

            if (attempts <= this.MAX_RECONNECT_ATTEMPTS) {
              const delayMs = Math.min(5000 * Math.pow(2, attempts - 1), 60000);
              console.log(`[MultiWhatsApp] Reconectando ${connection.id} en ${delayMs / 1000}s (intento ${attempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
              setTimeout(() => this.connectSocket(connection), delayMs);
            } else {
              console.error(`[MultiWhatsApp] Máximo de reintentos alcanzado para ${connection.id}. Esperando reconexión manual.`);
              this.reconnectAttempts.delete(connection.id);
            }
          }
        } else if (connStatus === 'open') {
          this.reconnectAttempts.delete(connection.id);
          const userJid = connection.socket.user?.id;
          const phoneNumber = userJid ? userJid.split(':')[0].split('@')[0] : undefined;

          connection.status = 'connected';
          connection.qr = undefined;
          connection.phoneNumber = phoneNumber;
          connection.lastConnectedAt = new Date();

          this.updateConnectionStatus(connection.id, 'connected', undefined, phoneNumber);
        }
      });

      connection.socket.ev.on('messages.upsert', async (m: { messages: proto.IWebMessageInfo[], type: string }) => {
        if (m.type === 'notify') {
          for (const msg of m.messages) {
            const jid = msg.key?.remoteJid;
            const fromMe = msg.key?.fromMe;
            console.log(`[DEBUG_JID] Incoming message from: ${jid} (fromMe: ${fromMe})`);

            if (msg.key && !fromMe && msg.message) {
              // Ignore WhatsApp status updates and other broadcast JIDs
              if (jid === 'status@broadcast' || jid?.includes('@broadcast')) {
                console.log(`[MultiWhatsApp] Ignoring broadcast/status message from: ${jid}`);
                continue;
              }

              // If group, log but continue (this will allow groups to be processed)
              const isGroup = jid?.includes('@g.us');
              if (isGroup) {
                console.log(`[MultiWhatsApp] Group message detected from: ${jid}`);
              }

              await this.processIncomingMessage(msg, connection);
            }
          }
        }
      });

    } catch (error) {
      console.error(`Error connecting socket for ${connection.id}:`, error);
      connection.status = 'error';
      this.updateConnectionStatus(connection.id, 'error');
    }
  }

  // Process incoming message for a specific connection
  private async processIncomingMessage(msg: proto.IWebMessageInfo, connection: WhatsAppConnection) {
    try {
      const senderPhone = this.extractPhoneNumber(msg);
      if (!senderPhone) {
        console.log('[MultiWhatsApp] Could not extract phone number from message');
        return;
      }

      console.log(`[MultiWhatsApp] Incoming message from ${senderPhone} on connection ${connection.displayName}`);

      // Format message for flow engine
      const formattedMessage = this.formatMessage(msg, senderPhone);
      if (!formattedMessage) {
        console.log('[MultiWhatsApp] Skipping technical/ignored message');
        return;
      }

      // Save to history
      const profileName = msg.pushName || '';
      const { contact, conversation } = await this.saveMessageData(formattedMessage, senderPhone, connection, null, profileName);

      // Process message through bot engine
      const organizationConfig = {
        organizationId: connection.organizationId,
        conversationId: conversation?.id || undefined,
        contactId: contact?.id || undefined,
        whatsappConnectionId: connection.id,
        senderJid: msg.key?.remoteJid || undefined
      };

      if (process.env.USE_REDIS === 'true') {
        // Route to message queue for async processing (RF-05)
        try {
          await messageQueueService.addMessageToQueue({
            messageId: msg.key?.id || '',
            connectionId: connection.id,
            organizationId: connection.organizationId,
            conversationId: conversation?.id || '',
            contactId: contact?.id || '',
            senderPhone,
            message: formattedMessage,
            timestamp: new Date().toISOString(),
          });
          console.log(`[MultiWhatsApp] Message routed to queue for async processing`);
        } catch (queueError) {
          console.error(`[MultiWhatsApp] Error routing to queue, processing synchronously:`, queueError);
          await handleIncomingMessage(formattedMessage, senderPhone, organizationConfig, this.createWaServiceAdapter(connection));
        }
      } else {
        // Process synchronously (local development without Redis)
        console.log(`[MultiWhatsApp] Processing message synchronously (no Redis)`);
        try {
          await handleIncomingMessage(formattedMessage, senderPhone, organizationConfig, this.createWaServiceAdapter(connection));
          console.log(`[MultiWhatsApp] ✅ Flow processing completed for ${senderPhone}`);
        } catch (flowError) {
          console.error(`[MultiWhatsApp] ❌ Error in flow processing:`, flowError);
        }
      }

    } catch (error) {
      console.error(`Error processing message for connection ${connection.id}:`, error);
    }
  }

  private extractPhoneNumber(msg: proto.IWebMessageInfo): string {
    if (!msg.key?.remoteJid) return '';

    const remoteJid = msg.key.remoteJid;
    const remoteJidAlt = (msg.key as any)?.remoteJidAlt;
    const messageContent = msg.message;
    const senderPn = (messageContent as any)?.senderPn || (messageContent as any)?.protocolMessage?.senderPn;

    let extractedNumber = '';

    if (remoteJidAlt && remoteJidAlt.includes('@s.whatsapp.net')) {
      extractedNumber = remoteJidAlt.split('@')[0];
    } else if (senderPn) {
      extractedNumber = senderPn.split('@')[0];
    } else if (remoteJid && !remoteJid.endsWith('@lid')) {
      extractedNumber = remoteJid.split('@')[0].split(':')[0];
    } else {
      extractedNumber = remoteJid ? remoteJid.split('@')[0] : '';
    }

    const isLid = remoteJid && remoteJid.endsWith('@lid');
    // Si el número extraído parece un ID largo (más de 13 dígitos) o es un LID, intentar obtener el número real de otras fuentes
    if (extractedNumber.length > 13 || isLid) {
      console.log(`[MultiWhatsApp] Extracted number looks like ID: ${extractedNumber}, trying to get real phone number`);

      // Intentar obtener el número del participant list si es un grupo
      if (msg.key?.participant) {
        const participantNumber = msg.key.participant.split('@')[0].split(':')[0];
        if (participantNumber.length <= 15 && !msg.key.participant.endsWith('@lid')) {
          console.log(`[MultiWhatsApp] Using participant number: ${participantNumber}`);
          return participantNumber;
        }
      }

      // Intentar obtener el número de otros campos del mensaje
      const contextInfo = (messageContent as any)?.contextInfo;
      if (contextInfo?.participant) {
        const contextParticipant = contextInfo.participant.split('@')[0].split(':')[0];
        if (contextParticipant.length <= 15 && !contextInfo.participant.endsWith('@lid')) {
          console.log(`[MultiWhatsApp] Using context participant number: ${contextParticipant}`);
          return contextParticipant;
        }
      }

      // Intentar obtener el número de quoted messages
      const quotedMessage = (messageContent as any)?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quotedMessage) {
        const quotedParticipant = (messageContent as any)?.extendedTextMessage?.contextInfo?.participant;
        if (quotedParticipant) {
          const quotedNumber = quotedParticipant.split('@')[0].split(':')[0];
          if (quotedNumber.length <= 15 && !quotedParticipant.endsWith('@lid')) {
            console.log(`[MultiWhatsApp] Using quoted participant number: ${quotedNumber}`);
            return quotedNumber;
          }
        }
      }

      // Si no se puede obtener un número real, usar el ID como fallback pero loggear el problema
      console.log(`[MultiWhatsApp] Could not extract real phone number, using ID: ${extractedNumber}`);
    }

    return extractedNumber;
  }

  private readAuthState(authPath: string): any {
    const credsPath = path.join(authPath, 'creds.json');
    if (!fs.existsSync(credsPath)) {
      throw new Error('creds.json not found');
    }

    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
    const keys: any = {};

    const keyFiles = fs.readdirSync(authPath).filter(f => f.endsWith('.json') && f !== 'creds.json');
    for (const keyFile of keyFiles) {
      const keyPath = path.join(authPath, keyFile);
      const keyContent = fs.readFileSync(keyPath, 'utf-8');
      keys[keyFile.replace('.json', '')] = JSON.parse(keyContent);
    }

    return { creds, keys };
  }

  private formatMessage(msg: proto.IWebMessageInfo, senderPhone: string): any {
    if (!msg.message) return null;

    // Detect technical/control messages that should be ignored in the UI
    const isControlMessage = !!(
      msg.message?.protocolMessage ||
      msg.message?.senderKeyDistributionMessage ||
      msg.message?.stickerMessage || // Optional: ignore stickers if not handled
      msg.message?.reactionMessage
    );

    if (isControlMessage) return null;

    const text = msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      msg.message?.documentMessage?.caption;

    const buttonReply = msg.message?.buttonsResponseMessage ||
      msg.message?.templateButtonReplyMessage ||
      msg.message?.interactiveResponseMessage;

    const listReply = msg.message?.listResponseMessage;

    let formattedMessage: any = {
      id: msg.key?.id || '',
      from: senderPhone,
      jid: msg.key?.remoteJid || `${senderPhone}@s.whatsapp.net`,
      type: 'text'
    };

    if (text) {
      const cleanText = text.trim();
      const numberMatch = cleanText.match(/^(\d+)$/);

      formattedMessage.text = { body: text };
      if (numberMatch) {
        formattedMessage.isNumericButtonResponse = true;
        formattedMessage.buttonNumber = numberMatch[1];
      }
    } else if (buttonReply) {
      const selectedId = (buttonReply as any).selectedButtonId || (buttonReply as any).selectedId;
      const selectedText = (buttonReply as any).selectedDisplayText || (buttonReply as any).bodyText;

      formattedMessage.type = 'interactive';
      formattedMessage.interactive = {
        type: 'button_reply',
        button_reply: {
          id: selectedId,
          title: selectedText
        }
      };
    } else if (listReply) {
      // Respuesta de un list-interactive ("Ver opciones")
      formattedMessage.type = 'interactive';
      formattedMessage.interactive = {
        type: 'list_reply',
        list_reply: {
          id: (listReply as any).selectedRowId || (listReply as any).selectedId,
          title: (listReply as any).title || (listReply as any).selectedDisplayText
        }
      };
    } else if (msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.audioMessage || msg.message?.documentMessage) {
      formattedMessage.type = 'media';
      formattedMessage.media = {
        type: msg.message?.imageMessage ? 'image' :
          msg.message?.videoMessage ? 'video' :
            msg.message?.audioMessage ? 'audio' : 'document'
      };
    } else {
      // If we reach here and it's not a known type, it's likely a technical message we don't want
      return null;
    }

    return formattedMessage;
  }

  private async saveMessageData(message: any, senderPhone: string, connection: WhatsAppConnection, flow: any, profileName: string = ''): Promise<{ contact: any, conversation: any }> {
    // Similar to existing logic but using connection-specific organization
    const isGroup = (message.jid || '').includes('@g.us');
    const messageJid = message.jid || (senderPhone ? `${senderPhone}@s.whatsapp.net` : '');

    // Un LID de WhatsApp es un ID privado (ej: 93080682238146@lid) que NO es un número real.
    // No debe guardarse como phone_number (el "número largo" que quedaba guardado).
    // Solamente se puede usar un LID como identificador interno (whatsapp_jid), nunca como teléfono.
    const isLid = messageJid.toLowerCase().endsWith('@lid');
    const lidPrefix = messageJid.split('@')[0];
    const isSenderPhoneActuallyLid = isLid && senderPhone === lidPrefix;
    const usablePhone = isSenderPhoneActuallyLid ? '' : senderPhone;

    // Obtener el contacto existente, primero por el JID de WhatsApp (LID) y luego por teléfono.
    // Así los contactos con LID se reutilizan sin duplicarse y preservan un número real previo.
    let existingContact: any | null = null;
    if (isLid) {
      const { data: byJid } = await supabase
        .from('contacts')
        .select('*')
        .eq('organization_id', connection.organizationId)
        .eq('custom_attributes->>whatsapp_jid', messageJid)
        .maybeSingle();
      existingContact = byJid || null;
    }
    if (!existingContact) {
      const { data: byPhone } = await supabase
        .from('contacts')
        .select('*')
        .eq('organization_id', connection.organizationId)
        .eq('phone_number', usablePhone)
        .maybeSingle();
      existingContact = byPhone || null;
    }

    // Construir custom_attributes preservando datos existentes
    const existingAttrs = existingContact?.custom_attributes || {};
    const newAttrs = {
      ...existingAttrs,
      whatsapp_jid: messageJid,
      is_group: isGroup
    };

    let contact: any = existingContact;

    if (existingContact) {
      // Preservar el número real si el contacto ya lo tenía (el LID no debe sobrescribirlo).
      const finalPhone = usablePhone || existingContact.phone_number || '';
      const { data: updated } = await supabase
        .from('contacts')
        .update({
          profile_name: profileName || existingContact.profile_name,
          phone_number: finalPhone,
          last_active_at: new Date().toISOString(),
          custom_attributes: newAttrs
        })
        .eq('id', existingContact.id)
        .select()
        .single();
      contact = updated || existingContact;
    } else {
      const { data: created } = await supabase
        .from('contacts')
        .insert({
          organization_id: connection.organizationId,
          phone_number: usablePhone,
          profile_name: profileName,
          last_active_at: new Date().toISOString(),
          custom_attributes: newAttrs
        })
        .select()
        .single();
      contact = created;
    }

    let { data: conversations } = await supabase
      .from('conversations')
      .select('*')
      .eq('organization_id', connection.organizationId)
      .eq('contact_id', contact.id)
      .eq('whatsapp_connection_id', connection.id)
      .order('last_message_at', { ascending: false })
      .limit(1);

    let conversation = conversations && conversations.length > 0 ? conversations[0] : null;

    if (!conversation) {
      const { data: newConversation } = await supabase
        .from('conversations')
        .insert({
          organization_id: connection.organizationId,
          contact_id: contact.id,
          whatsapp_connection_id: connection.id
        })
        .select()
        .single();
      conversation = newConversation;
    }

    await supabase.from('messages').insert({
      organization_id: connection.organizationId,
      conversation_id: conversation.id,
      contact_id: contact.id,
      direction: 'inbound',
      type: message.type,
      content: JSON.stringify(message),
      whatsapp_message_id: message.id
    });

    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation.id);

    return { contact, conversation };
  }

  public createWaServiceAdapter(connection: WhatsAppConnection) {
    return {
      sendTextMessage: async (to: string, body: string, options?: { jid?: string }) => {
        const jid = options?.jid || (to.includes('@') ? to : `${to}@s.whatsapp.net`);
        return await connection.socket?.sendMessage(jid, { text: body });
      },
      sendButtonMessage: async (to: string, bodyText: string, buttons: any[], options?: { jid?: string; showBackButton?: boolean; backButtonLabel?: string; listButtonLabel?: string }) => {
        const jid = options?.jid || (to.includes('@') ? to : `${to}@s.whatsapp.net`);

        const buttonMapping: { [key: string]: string } = {};
        buttons.forEach((btn, index) => {
          buttonMapping[(index + 1).toString()] = btn.id || `btn-${index}`;
        });

        // List-interactive "Ver opciones" para menús de hasta 10 opciones
        // (más cómodo de leer que la lista numerada). Más de 10 → texto numerado.
        if (buttons.length <= 10 && connection.socket) {
          const rows = buttons.map((btn: any, index: number) => ({
            title: (btn.text || btn.title || `Opción ${index + 1}`).substring(0, 24),
            rowId: btn.id || `btn_${index}`,
            description: btn.description ? btn.description.substring(0, 72) : undefined,
          }));

          if (options?.showBackButton && rows.length < 10) {
            rows.push({ title: options?.backButtonLabel || '↩ Volver', rowId: 'btn_back', description: undefined });
          }

          const sections: any[] = [];
          for (let i = 0; i < rows.length; i += 10) {
            sections.push({
              title: rows.length > 10 ? `Opciones ${sections.length + 1}` : 'Opciones',
              rows: rows.slice(i, i + 10),
            });
          }

          try {
            const result = await connection.socket.sendMessage(jid, {
              list: {
                title: 'Elige una opción',
                text: bodyText,
                buttonText: options?.listButtonLabel || 'Ver opciones',
                footerText: 'Responde con el número o toca la opción',
                sections,
              },
            });

            return {
              ...result,
              buttonMapping,
              isNumericButtons: true,
            };
          } catch (listErr: any) {
            console.error('[MultiWhatsApp] List message failed, falling back to numbered text:', listErr?.message);
          }
        }

        const numberedOptions = buttons.map((btn, index) => `${index + 1}. ${btn.text || btn.title || 'Opción'}`).join('\n');
        const fullMessage = `${bodyText}\n\n${numberedOptions}\n\n💡 *Responde con el número de tu opción*`;
        const result = await connection.socket?.sendMessage(jid, { text: fullMessage });

        return {
          ...result,
          buttonMapping,
          isNumericButtons: true
        };
      },
      sendMediaMessage: async (to: string, url: string, options?: any) => {
        const jid = options?.jid || (to.includes('@') ? to : `${to}@s.whatsapp.net`);
        const ext = url.split('.').pop()?.toLowerCase() || '';
        const type = options?.type || (['png', 'jpg', 'jpeg'].includes(ext) ? 'image' : 'document');

        if (type === 'image') {
          return await connection.socket?.sendMessage(jid, { image: { url }, caption: options?.caption });
        }
        // Add other media types as needed
        return await connection.socket?.sendMessage(jid, { document: { url }, caption: options?.caption });
      },
      sendImageMessage: async (to: string, base64Data: string, caption?: string) => {
        const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
        const buffer = Buffer.from(base64Data, 'base64');
        return await connection.socket?.sendMessage(jid, { image: buffer, caption: caption || undefined });
      }
    };
  }

  private async updateConnectionStatus(connectionId: string, status: string, qr?: string, phoneNumber?: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.status = status as any;
    if (qr) connection.qr = qr;
    if (phoneNumber) connection.phoneNumber = phoneNumber;

    const updateData: any = {
      status,
      qr_code: qr || null,
      last_connected_at: status === 'connected' ? new Date().toISOString() : null
    };

    if (phoneNumber) {
      updateData.phone_number = phoneNumber;
    }

    await supabase
      .from('whatsapp_connections')
      .update(updateData)
      .eq('id', connectionId);

    // Broadcast status update via WebSocket (RF-02)
    if (io) {
      io.to(`org:${connection.organizationId}`).emit('connection-status-update', {
        connectionId,
        status,
        qr,
        phoneNumber,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Public methods
  async getConnectionQR(connectionId: string, userId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.userId !== userId) {
      throw new Error('Conexión no encontrada');
    }

    if (connection.status === 'disconnected' || connection.status === 'error') {
      await this.connectSocket(connection);
    }

    // No waiting here to avoid blocking API responses.
    // The frontend should poll or wait.

    // Generate QR image
    if (connection.qr) {
      const QRCode = await import('qrcode');
      return await QRCode.toDataURL(connection.qr);
    }

    return null;
  }

  async deleteConnection(connectionId: string, userId: string) {
    const connection = this.connections.get(connectionId);

    // Even if not in memory, we should try to delete from DB
    // But we need the userId to be sure we're deleting the right one

    if (connection) {
      // Disconnect socket if exists
      if (connection.socket) {
        try {
          await connection.socket.logout();
        } catch (err) {
          console.error('Error during socket logout:', err);
        }
      }

      // Clean up ephemeral auth state (RNF-05)
      if (connection.authStatePath && fs.existsSync(connection.authStatePath)) {
        try {
          fs.rmSync(connection.authStatePath, { recursive: true, force: true });
        } catch (err) {
          console.error('Error removing auth state:', err);
        }
      }

      // Delete session from database
      await sessionPersistenceService.deleteSession(connectionId);

      this.connections.delete(connectionId);
    }

    // Always attempt to delete from database if we have the userId
    const { error: dbError } = await supabase
      .from('whatsapp_connections')
      .delete()
      .eq('id', connectionId)
      .eq('user_id', userId);

    if (dbError) {
      console.error('Error deleting connection from DB:', dbError);
    }

    // Update user's active connections count
    const { data: user } = await supabase
      .from('users')
      .select('active_whatsapp_connections')
      .eq('id', userId)
      .single();

    if (user && user.active_whatsapp_connections !== undefined) {
      await supabase
        .from('users')
        .update({ active_whatsapp_connections: Math.max(0, user.active_whatsapp_connections - 1) })
        .eq('id', userId);
    }

    this.connections.delete(connectionId);
  }

  getUserConnections(userId: string) {
    return Array.from(this.connections.values()).filter(conn => conn.userId === userId);
  }

  getOrganizationConnections(organizationId: string) {
    return Array.from(this.connections.values()).filter(conn => conn.organizationId === organizationId);
  }

  getConnection(connectionId: string) {
    return this.connections.get(connectionId);
  }
}

export const multiWhatsAppService = new MultiWhatsAppService();
