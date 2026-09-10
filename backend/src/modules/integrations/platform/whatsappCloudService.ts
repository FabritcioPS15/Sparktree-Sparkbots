/**
 * WhatsApp Cloud API Service
 * Integration with Meta's WhatsApp Business API for multi-platform support
 */

import axios from 'axios';
import FormData from 'form-data';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { BasePlatformService, PlatformConnection, PlatformMessage, PlatformServiceAdapter } from './basePlatformService';
import { supabase } from '../../../core/config/supabase';
import { handleIncomingMessage } from '../../bots/engine/flow-core';

// Convierte audio del navegador (webm/mp4) al único formato de nota de voz que
// WhatsApp entrega: `audio/ogg` con codec Opus. Retorna el buffer .ogg o null si
// falla/falta ffmpeg (en ese caso se sube el original).
async function convertToOggOpus(input: Buffer, ext: string): Promise<Buffer | null> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-audio-'));
  const src = path.join(tmp, `in.${ext}`);
  const out = path.join(tmp, 'out.ogg');
  try {
    fs.writeFileSync(src, input);
    await new Promise<void>((resolve, reject) => {
      execFile('ffmpeg', ['-y', '-i', src, '-vn', '-c:a', 'libopus', '-b:a', '48k', '-ar', '48000', '-ac', '1', out], { timeout: 20000 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    return fs.readFileSync(out);
  } catch (e: any) {
    console.warn('[whatsapp] ffmpeg conversión de audio falló:', e?.message || e);
    return null;
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* noop */ }
  }
}

export class WhatsAppCloudService extends BasePlatformService {
  private webhookVerifyTokens: Map<string, string> = new Map();

  getPlatformType(): 'whatsapp' | 'telegram' | 'instagram' | 'tiktok' | 'facebook_messenger' | 'mercadolibre' {
    return 'whatsapp';
  }

  async initializeConnection(connectionData: any): Promise<void> {
    const config = connectionData.config || {};
    const phoneNumberId = connectionData.platform_account_id || connectionData.phone_number_id || config.phone_number_id;
    const accessToken = connectionData.access_token || config.access_token;
    const webhookVerifyToken = connectionData.webhook_verify_token || config.webhook_verify_token;

    const connection: PlatformConnection = {
      id: connectionData.id,
      userId: connectionData.user_id,
      organizationId: connectionData.organization_id,
      platformType: 'whatsapp',
      displayName: connectionData.display_name,
      platformAccountId: phoneNumberId,
      status: connectionData.status || 'disconnected',
config: {
          phoneNumberId,
          accessToken,
          webhookVerifyToken,
          ...((connectionData.config?.waba_id || connectionData.waba_id) ? { waba_id: connectionData.config?.waba_id || connectionData.waba_id } : {}),
        },
      lastConnectedAt: connectionData.last_connected_at ? new Date(connectionData.last_connected_at) : undefined,
    };

    this.connections.set(connection.id, connection);
    
    // Store verify token for webhook verification
    if (connection.config.webhookVerifyToken) {
      this.webhookVerifyTokens.set(connection.id, connection.config.webhookVerifyToken);
    }
  }

  async startConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) throw new Error('Connection not found');

    // For Cloud API, connection is always "connected" if credentials are valid
    connection.status = 'connected';
    connection.lastConnectedAt = new Date();

    await this.updateConnectionStatus(connectionId, 'connected');

    // Auto-register webhook with Meta if verify token is configured
    if (connection.config.webhookVerifyToken) {
      await this.setupWebhook(connection);
    }
  }

  private async setupWebhook(connection: PlatformConnection): Promise<void> {
    try {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
      const webhookUrl = `${backendUrl}/api/webhook`;
      const verifyToken = connection.config.webhookVerifyToken;

      // Subscribe to messages field via Meta Graph API
      await axios.post(
        `https://graph.facebook.com/v21.0/${connection.config.phoneNumberId}`,
        null,
        {
          params: {
            access_token: connection.config.accessToken,
            object: 'whatsapp_business_account',
            callback_url: webhookUrl,
            fields: 'messages',
            verify_token: verifyToken,
          },
        }
      );

      console.log(`[WhatsApp Cloud] Webhook subscribed for ${connection.displayName} → ${webhookUrl}`);
    } catch (error: any) {
      // Non-fatal: user can still register webhook manually in Meta dashboard
      console.warn(`[WhatsApp Cloud] Auto webhook registration failed for ${connection.displayName}:`, error?.response?.data?.error?.message || error.message);
    }
  }

  async deleteConnection(connectionId: string, userId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    this.connections.delete(connectionId);
    this.webhookVerifyTokens.delete(connectionId);

    // Delete from database
    await supabase
      .from('platform_connections')
      .delete()
      .eq('id', connectionId)
      .eq('user_id', userId);
  }

  async processIncomingMessage(rawMessage: any, connection: PlatformConnection): Promise<void> {
    try {
      const message = this.formatPlatformMessage(rawMessage);
      if (!message) return;

      const senderPhone = message.from;
      
      // Save to database
      const { data: contact } = await supabase
        .from('contacts')
        .upsert({
          organization_id: connection.organizationId,
          phone_number: senderPhone,
          profile_name: rawMessage.contact?.name || '',
          last_active_at: new Date().toISOString(),
          custom_attributes: {
            platform: 'whatsapp_cloud',
            connection_id: connection.id,
          },
        })
        .select()
        .single();

      if (!contact) return;

      // Get or create conversation
      let { data: conversation } = await supabase
        .from('conversations')
        .select('*')
        .eq('organization_id', connection.organizationId)
        .eq('contact_id', contact.id)
        .eq('platform_connection_id', connection.id)
        .single();

      if (!conversation) {
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({
            organization_id: connection.organizationId,
            contact_id: contact.id,
            platform_connection_id: connection.id,
            // 'whatsapp' (not 'whatsapp_cloud'): the deployed CHECK constraint
            // may not include 'whatsapp_cloud' yet. Cloud-vs-QR is tracked via
            // platform_connection_id instead.
            platform_type: 'whatsapp',
          })
          .select()
          .single();
        conversation = newConv;
      }

      // Save message (normalize type to satisfy messages.type CHECK constraint)
      let messageType = message.type || 'text';
      let messageContent: string = message.text || (typeof message.text === 'string' ? message.text : JSON.stringify(message));

      if (message.type === 'interactive') {
        const replyText = message.interactive?.button_reply?.title || message.interactive?.quick_reply?.text;
        messageType = 'text';
        messageContent = replyText || 'Opción seleccionada';
      } else if (message.type === 'media') {
        messageType = message.media?.type || 'image';
      } else if (message.type === 'image') messageType = 'image';
      else if (message.type === 'video') messageType = 'video';
      else if (message.type === 'document') messageType = 'document';
      else if (message.type === 'audio') messageType = 'audio';

      await supabase.from('messages').insert({
        organization_id: connection.organizationId,
        conversation_id: conversation.id,
        contact_id: contact.id,
        direction: 'inbound',
        type: messageType,
        content: messageContent,
        whatsapp_message_id: message.id,
      });

      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id);

      // Process with flow engine
      // Detect numeric button responses: when the user sends a plain number
      // (e.g. "3") in response to a numbered menu, flag it so the flow engine
      // can map it to the corresponding button.
      const textContent = message.text ?? messageContent;
      const numericMatch = (typeof textContent === 'string') ? textContent.trim().match(/^\d+$/) : null;
      if (numericMatch && conversation?.id) {
        const { data: lastOutbound } = await supabase
          .from('messages')
          .select('content')
          .eq('conversation_id', conversation.id)
          .eq('direction', 'outbound')
          .order('created_at', { ascending: false })
          .limit(5)
          .maybeSingle();
        if (lastOutbound?.content) {
          try {
            const parsed = JSON.parse(lastOutbound.content);
            if (parsed?.buttonMapping && parsed.buttonMapping[textContent.trim()]) {
              (message as any).isNumericButtonResponse = true;
              (message as any).buttonNumber = textContent.trim();
            }
          } catch {}
        }
      }

      const organizationConfig = {
        organizationId: connection.organizationId,
        conversationId: conversation.id,
        contactId: contact.id,
        whatsappConnectionId: connection.id,
      };

      const serviceAdapter = this.createServiceAdapter(connection);
      await handleIncomingMessage(message, senderPhone, organizationConfig, serviceAdapter);

    } catch (error) {
      console.error('[WhatsApp Cloud] Error processing message:', error);
    }
  }

  createServiceAdapter(connection: PlatformConnection): PlatformServiceAdapter {
    const config = connection.config;

    return {
      sendTextMessage: async (to: string, body: string, options?: any) => {
        const phoneNumber = to.includes('@') ? to.split('@')[0] : to;
        const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;
        
        const textPayload: any = { body };
        if (/(https?:\/\/|www\.)\S+/i.test(body || '')) {
          textPayload.preview_url = true;
        }

        const response = await axios({
          method: 'POST',
          url,
          headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          data: {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'text',
            text: textPayload,
          },
        });

        return response.data;
      },

      sendButtonMessage: async (to: string, bodyText: string, buttons: any[], options?: any) => {
        const phoneNumber = to.includes('@') ? to.split('@')[0] : to;
        const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;

      const originalButtons = buttons || [];

      // Opción automática "Volver": se agrega al final del list cuando el
      // cliente tiene historial de nodos. Usa un id reservado (btn_back).
      // Se mantiene separada para NO contarla en el límite de opciones del
      // list message de Meta (soporta hasta 10 filas).
      const backLabel = options?.backButtonLabel || '↩ Volver';
      const showBack = !!options?.showBackButton;
      const backButton = showBack ? { id: 'btn_back', title: backLabel, text: backLabel } : null;

      // allButtons = opciones reales + (opcional) btn_back
      const allButtons = backButton ? [...originalButtons, backButton] : [...originalButtons];

      const buttonMapping: { [key: string]: string } = {};

      // Build mapping for numeric replies (1-based, covers every option).
      allButtons.forEach((btn, index) => {
        buttonMapping[(index + 1).toString()] = btn.id || `btn_${index}`;
      });

      // Helper to build a numbered text list (no option limit).
      // Opción "Volver" se muestra al final separada para no contaminar la
      // numeración de opciones reales.
      const buildNumberedText = () => {
        const numberedOptions = originalButtons.map((btn, index) => {
          return `${index + 1}. ${btn.title || btn.text || `Opción ${index + 1}`}`;
        }).join('\n');
        const backLine = backButton ? `\n${allButtons.length}. ${backLabel}` : '';
        return `${bodyText}\n\n${numberedOptions}${backLine}\n\nResponde con el número de tu opción`;
      };

      // Meta "list" interactive soporta hasta 10 filas por sección. Se usa para
      // menús de hasta 10 opciones ("Ver opciones") porque es mucho más cómodo de
      // leer que la lista numerada de texto. Solo se cae a texto numerado cuando
      // el menú supera las 10 opciones (buildListInteractive particiona en secciones).
      if (allButtons.length > 10) {
        const numberedMessage = buildNumberedText();
        const numberedResponse = await axios({
          method: 'POST',
          url,
          headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          data: {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'text',
            text: { body: numberedMessage },
          },
        });

        return { ...numberedResponse.data, buttonMapping, isNumericButtons: true };
      }

      const buttonLabel = (options?.listButtonLabel) || 'Ver opciones';
      const catalogTitle = (options?.catalogTitle) || 'Elige una opción';
      const sectionTitle = (options?.sectionTitle) || 'Opciones';

      // Meta "list" interactive: each row is clickable and opens a vertical
      // list ("Ver opciones"). Supports up to 10 rows per section.
      const buildListInteractive = () => {
        const rows = allButtons.map((btn, index) => ({
          id: btn.id || `btn_${index}`,
          title: (btn.title || btn.text || `Opción ${index + 1}`).substring(0, 24),
          description: btn.description ? btn.description.substring(0, 72) : undefined,
        }));

        const sections: any[] = [];
        for (let i = 0; i < rows.length; i += 10) {
          sections.push({
            title: rows.length > 10 ? `${sectionTitle} ${sections.length + 1}` : sectionTitle,
            rows: rows.slice(i, i + 10),
          });
        }

        return {
          type: 'list',
          header: { type: 'text', text: catalogTitle.substring(0, 60) },
          body: { text: (bodyText || '').substring(0, 1024) },
          action: {
            button: buttonLabel.substring(0, 20),
            sections,
          },
        };
      };

      // Meta "button" interactive con quick replies nativos (máx. 3 botones).
      // Mucho más cómodo para menús cortos (p.ej. confirmación Sí/No o hasta 3
      // opciones), y de paso le da los botones "reales" clickeables de WhatsApp.
      const buildNativeButtons = () => ({
        type: 'button',
        header: { type: 'text', text: catalogTitle.substring(0, 60) },
        body: { text: (bodyText || '').substring(0, 1024) },
        action: {
          buttons: allButtons.map((btn, index) => ({
            type: 'reply',
            reply: {
              id: btn.id || `btn_${index}`,
              title: (btn.title || btn.text || `Opción ${index + 1}`).substring(0, 20),
            },
          })),
        },
      });

      // Probamos primero botones nativos (<=3 opciones). Si Meta los rechaza
      // (p.ej. sesión fuera de 24h), caemos al listado interactivo.
      if (allButtons.length <= 3) {
        try {
          const response = await axios({
            method: 'POST',
            url,
            headers: {
              'Authorization': `Bearer ${config.accessToken}`,
              'Content-Type': 'application/json',
            },
            data: {
              messaging_product: 'whatsapp',
              to: phoneNumber,
              type: 'interactive',
              interactive: buildNativeButtons(),
            },
          });
          return { ...response.data, buttonMapping, isNumericButtons: false };
        } catch (error: any) {
          const metaErr = error?.response?.data?.error;
          console.warn(`[WhatsApp Cloud] Native buttons FAILED (${metaErr ? `${metaErr.code}: ${metaErr.message}` : error.message}). Falling back to list interactive.`);
        }
      }

      // Try sending the native list interactive message.
      try {
        const response = await axios({
          method: 'POST',
          url,
          headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          data: {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'interactive',
            interactive: buildListInteractive(),
          },
        });

        return { ...response.data, buttonMapping, isNumericButtons: true };
      } catch (error: any) {
        const metaErr = error?.response?.data?.error;
        console.error(`[WhatsApp Cloud] List message FAILED:`, metaErr ? `${metaErr.code}: ${metaErr.message}` : error.message);

        // Fallback: numbered text list so no option is lost.
        const numberedMessage = buildNumberedText();
        const fallbackResponse = await axios({
          method: 'POST',
          url,
          headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          data: {
            messaging_product: 'whatsapp',
              to: phoneNumber,
              type: 'text',
              text: { body: numberedMessage },
            },
          });

          return { ...fallbackResponse.data, buttonMapping, isNumericButtons: true };
        }
      },

      sendMediaMessage: async (to: string, url: string, options?: any) => {
        const phoneNumber = to.includes('@') ? to.split('@')[0] : to;
        const apiUrl = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;
        
        const mediaType = options?.type || 'image';
        
        const response = await axios({
          method: 'POST',
          url: apiUrl,
          headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          data: {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: mediaType,
            [mediaType]: {
              link: url,
              caption: options?.caption,
            },
          },
        });

        return response.data;
      },

      // Sube un media en base64 (data URL) a Graph API y lo envía por media id.
      // Necesario porque Cloud API requiere una URL pública o un media_id, no
      // acepta base64 directo como destino.
      sendMediaBuffer: async (to: string, base64: string, options?: any) => {
        const phoneNumber = to.includes('@') ? to.split('@')[0] : to;
        const mediaType = options?.type || 'image';
        const mediaBase = `https://graph.facebook.com/v21.0/${config.phoneNumberId}`;

        // Extraer mime type y bytes del data URL (ej: data:image/png;base64,XXXX
        // o data:audio/webm;codecs=opus;base64,XXXX). Permite parámetros extra
        // en el mime type (como ;codecs=...) antes del marcador ;base64,.
        const match = base64.match(/^data:([^;,]+)(?:;[^,]*)*;base64,(.+)$/s);
        if (!match) {
          throw new Error('Formato de base64/mediaUrl no válido');
        }
        const mimeType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');

        const ext = mimeType.split('/')[1]?.split('+')[0] || 'bin';
        const filename = options?.filename || `upload-${Date.now()}.${ext}`;

        // WhatsApp (Cloud API) solo reproduce notas de voz en `audio/ogg` (opus).
        // El audio capturado en el navegador suele venir en webm/mp4 que Meta
        // sube pero no entrega. Convertimos a ogg/opus con ffmpeg antes de subir.
        let uploadMime = mimeType;
        let uploadBuffer: Buffer = buffer;
        let uploadFilename = filename;
        if (mediaType === 'audio') {
          const conv = await convertToOggOpus(uploadBuffer, ext);
          if (conv) {
            uploadMime = 'audio/ogg';
            uploadBuffer = conv;
            uploadFilename = `voice-${Date.now()}.ogg`;
          }
        }

        // 1) Subir el media a Graph API -> media_id (multipart)
        const uploadForm = new FormData();
        uploadForm.append('messaging_product', 'whatsapp');
        uploadForm.append('type', uploadMime);
        uploadForm.append('filename', uploadFilename);
        uploadForm.append('file', uploadBuffer, { filename: uploadFilename, contentType: uploadMime });

        console.log(`[whatsapp] upload media type=${mediaType} mine=${uploadMime} bytes=${uploadBuffer.length}`);

        const uploadRes = await axios.post(`${mediaBase}/media`, uploadForm, {
          headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            ...uploadForm.getHeaders(),
          },
        });
        const mediaId: string = uploadRes.data?.id;
        if (!mediaId) {
          throw new Error('No se pudo subir el media a WhatsApp');
        }

        // 2) Enviar el mensaje referenciando el media_id
        // Restricciones de Meta según el tipo:
        //  - `filename` solo es válido en `document` (rechaza en image/video/audio).
        //  - `caption` es inválido en `audio` (rechaza: "Unexpected key caption on param audio").
        const mediaBody: any = { id: mediaId };
        if (mediaType !== 'audio' && options?.caption) {
          mediaBody.caption = options.caption;
        }
        if ((mediaType === 'document') && options?.filename) {
          mediaBody.filename = options.filename;
        }

        const sendRes = await axios({
          method: 'POST',
          url: `${mediaBase}/messages`,
          headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          data: {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: mediaType,
            [mediaType]: mediaBody,
          },
        }).catch((err: any) => {
          const metaErr = err?.response?.data?.error;
          console.error(`[whatsapp] SEND ${mediaType} FAIL ->`, metaErr ? JSON.stringify(metaErr) : (err?.message || err));
          throw err;
        });

        return sendRes.data;
      },

      sendTemplateMessage: async (
        to: string,
        templateName: string,
        languageCode: string,
        components: any[] = []
      ) => {
        const phoneNumber = to.includes('@') ? to.split('@')[0] : to;
        const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;

        const requestBody = {
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            ...(components.length > 0 ? { components } : {}),
          },
        };

        console.log(`[WhatsApp Cloud] Sending template "${templateName}" to ${phoneNumber} lang=${languageCode}`);
        console.log(`[WhatsApp Cloud] Request body:`, JSON.stringify(requestBody, null, 2));

        try {
          const response = await axios({
            method: 'POST',
            url,
            headers: {
              'Authorization': `Bearer ${config.accessToken}`,
              'Content-Type': 'application/json',
            },
            data: requestBody,
          });

          console.log(`[WhatsApp Cloud] Template sent OK:`, response.data?.messages?.[0]?.id);
          return response.data;
        } catch (error: any) {
          const metaErr = error?.response?.data?.error || error?.response?.data;
          console.error(`[WhatsApp Cloud] Template FAILED:`, JSON.stringify(metaErr || error.message, null, 2));
          throw error;
        }
      },

      sendMarketingMessage: async (
        to: string,
        body: string,
        options?: { messageActivitySharing?: boolean; templateName?: string; languageCode?: string; components?: any[] }
      ) => {
        const phoneNumber = to.includes('@') ? to.split('@')[0] : to;
        const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/marketing_messages`;

        const payload: any = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phoneNumber,
        };

        if (options?.messageActivitySharing !== undefined) {
          payload.message_activity_sharing = options.messageActivitySharing;
        }

        // MM API envía templates de marketing: el cuerpo se define como "text" optimizable
        // o como "template" según la configuración de marketing del WABA.
        if (options?.templateName) {
          payload.type = 'template';
          payload.template = {
            name: options.templateName,
            language: { code: options.languageCode || 'es' },
            components: options?.components || [],
          };
        } else {
          payload.type = 'text';
          payload.text = { body };
        }

        const response = await axios({
          method: 'POST',
          url,
          headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          data: payload,
        });

        return response.data;
      },
    };
  }

  /** Obtiene el WABA ID a partir del Phone Number ID */
  private async getWabaId(connection: PlatformConnection): Promise<string> {
    const { phoneNumberId, accessToken } = connection.config;

    // Fuente 1: WABA guardado directamente en la config de la conexión
    const fromConfig = (connection.config as any)?.waba_id || (connection as any)?.waba_id || (connection as any)?.config?.wabaId;
    if (fromConfig) {
      console.log(`[WhatsApp Cloud] WABA ID from config: ${fromConfig}`);
      return fromConfig;
    }

    // Fuente 2: WABA reportado por el webhook (eventos account_update persistidos)
    try {
      const { data: events } = await supabase
        .from('platform_webhook_events')
        .select('waba_id, created_at')
        .eq('platform', 'whatsapp')
        .not('waba_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);
      const wabaFromEvents = events?.[0]?.waba_id;
      if (wabaFromEvents) {
        console.log(`[WhatsApp Cloud] WABA ID from webhook events: ${wabaFromEvents}`);
        return wabaFromEvents;
      }
    } catch (e: any) {
      console.warn('[WhatsApp Cloud] Could not read waba_id from webhook events:', e?.message || e);
    }

    // Fuente 3: resolver vía Graph API
    // Intento 1: nodo del phone number (sin el campo deprecado)
    const tryDirect = async (): Promise<string | null> => {
      try {
        const phoneInfo = await axios.get(
          `https://graph.facebook.com/v21.0/${phoneNumberId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { fields: 'id' },
          }
        );
        return phoneInfo.data?.whatsapp_business_account_id || null;
      } catch {
        return null;
      }
    };

    // Intento 2: sub-recurso oficial del número → WABA
    const trySubEntity = async (): Promise<string | null> => {
      try {
        const sub = await axios.get(
          `https://graph.facebook.com/v21.0/${phoneNumberId}/whatsapp_business_account`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const data = sub.data || {};
        return data?.id || data?.data?.[0]?.id || data?.whatsapp_business_account_id || null;
      } catch {
        return null;
      }
    };

    try {
      const wabaId = (await tryDirect()) || (await trySubEntity());
      if (wabaId) {
        console.log(`[WhatsApp Cloud] WABA ID resolved: ${wabaId} for Phone Number ID: ${phoneNumberId}`);
        return wabaId;
      }
      console.error(`[WhatsApp Cloud] No WABA ID found. Phone Number ID: ${phoneNumberId}. Ambos métodos de resolución fallaron.`);
      throw new Error('No se encontró el WABA ID para este número. Verifica el Phone Number ID y el Access Token.');
    } catch (err: any) {
      const metaError = err?.response?.data?.error;
      if (metaError) {
        console.error(`[WhatsApp Cloud] Failed to get WABA ID. Phone: ${phoneNumberId}, Meta error ${metaError.code}: ${metaError.message}`);
        throw new Error(`Meta API ${metaError.code}: ${metaError.message}. Verifica el Phone Number ID y el Access Token.`);
      }
      throw err;
    }
  }

  /** Lista TODOS los templates de Meta (todos los estados) para el WABA vinculado */
  async getMetaTemplates(connectionId: string): Promise<any[]> {
    const connection = this.connections.get(connectionId);
    if (!connection) throw new Error('Connection not found');

    console.log(`[WhatsApp Cloud] Fetching templates for connection ${connectionId}, Phone: ${connection.config.phoneNumberId}`);

    const wabaId = await this.getWabaId(connection);

    try {
      const response = await axios.get(
        `https://graph.facebook.com/v21.0/${wabaId}/message_templates`,
        {
          headers: { Authorization: `Bearer ${connection.config.accessToken}` },
          params: { limit: 200, fields: 'id,name,status,category,language,components,rejected_reason,quality_score' },
        }
      );

      const templates = response.data?.data || [];
      console.log(`[WhatsApp Cloud] Found ${templates.length} templates for WABA ${wabaId}`);
      return templates;
    } catch (err: any) {
      const metaError = err?.response?.data?.error;
      if (metaError) {
        console.error(`[WhatsApp Cloud] Failed to fetch templates. WABA: ${wabaId}, Meta error ${metaError.code}: ${metaError.message}`);
        throw new Error(`Meta API ${metaError.code}: ${metaError.message}`);
      }
      throw err;
    }
  }

  /** Crea un nuevo template en Meta (queda en PENDING hasta que Meta lo aprueba) */
  async createMetaTemplate(connectionId: string, templateData: {
    name: string;
    category: string;
    language: string;
    components: any[];
  }): Promise<any> {
    const connection = this.connections.get(connectionId);
    if (!connection) throw new Error('Connection not found');

    const wabaId = await this.getWabaId(connection);

    console.log(`[WhatsApp Cloud] Creating template "${templateData.name}" for WABA ${wabaId}`);

    const response = await axios.post(
      `https://graph.facebook.com/v21.0/${wabaId}/message_templates`,
      templateData,
      { headers: { Authorization: `Bearer ${connection.config.accessToken}`, 'Content-Type': 'application/json' } }
    );

    console.log(`[WhatsApp Cloud] Template created:`, response.data);
    return response.data;
  }

  /** Elimina un template de Meta por ID */
  async deleteMetaTemplate(connectionId: string, templateId: string, templateName: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) throw new Error('Connection not found');

    const wabaId = await this.getWabaId(connection);

    await axios.delete(
      `https://graph.facebook.com/v21.0/${wabaId}/message_templates`,
      {
        headers: { Authorization: `Bearer ${connection.config.accessToken}` },
        params: { name: templateName },
      }
    );

    console.log(`[WhatsApp Cloud] Template "${templateName}" deleted from WABA ${wabaId}`);
  }

  /**
   * MM API for WhatsApp: consulta la elegibilidad / estado de onboarding de la WABA.
   * Usa marketing_messages_onboarding_status (y owner_business_info para partners).
   * https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/onboarding
   */
  async getMarketingMessagesEligibility(connectionId: string): Promise<{
    eligible: boolean;
    status: string;
    termsOfServiceSigned: boolean;
    adAccountId?: string;
    ownerBusinessId?: string;
    checkedAt: Date;
  }> {
    const connection = this.connections.get(connectionId);
    if (!connection) throw new Error('Connection not found');

    const wabaId = await this.getWabaId(connection);
    const result = {
      eligible: false,
      status: 'UNKNOWN',
      termsOfServiceSigned: false,
      adAccountId: undefined as string | undefined,
      ownerBusinessId: undefined as string | undefined,
      checkedAt: new Date(),
    };

    try {
      const response = await axios.get(
        `https://graph.facebook.com/v25.0/${wabaId}`,
        {
          headers: { Authorization: `Bearer ${connection.config.accessToken}` },
          params: {
            fields: 'marketing_messages_onboarding_status,owner_business_info',
          },
        }
      );

      const data = response.data || {};
      const onboardingStatus = data.marketing_messages_onboarding_status;

      // Caso cliente directo: string "ELIGIBLE" / "ONBOARDED" / etc.
      if (typeof onboardingStatus === 'string') {
        result.status = onboardingStatus;
        result.eligible = onboardingStatus === 'ELIGIBLE' || onboardingStatus === 'ONBOARDED';
        result.termsOfServiceSigned = onboardingStatus === 'ONBOARDED';
      }
      // Caso partner/negocio: objeto { status: "TERM_OF_SERVICE_SIGNED"|"REQUEST_SENT"|"NOT_STARTED", time }
      else if (onboardingStatus && typeof onboardingStatus === 'object') {
        result.status = onboardingStatus.status || 'UNKNOWN';
        result.termsOfServiceSigned = onboardingStatus.status === 'TERM_OF_SERVICE_SIGNED';
        result.eligible = result.termsOfServiceSigned;
      }

      if (data.owner_business_info) {
        const obi = data.owner_business_info;
        result.ownerBusinessId = obi.id;
        if (!result.eligible && obi.marketing_messages_onboarding_status) {
          const st = obi.marketing_messages_onboarding_status.status;
          result.status = st || result.status;
          result.termsOfServiceSigned = st === 'TERM_OF_SERVICE_SIGNED';
          result.eligible = result.termsOfServiceSigned;
        }
      }

      console.log(`[WhatsApp Cloud] MM API eligibility for WABA ${wabaId}:`, result.status);
    } catch (err: any) {
      const metaError = err?.response?.data?.error;
      if (metaError) {
        console.error(`[WhatsApp Cloud] Failed to get MM API eligibility. WABA ${wabaId}, Meta error ${metaError.code}: ${metaError.message}`);
      } else {
        console.error(`[WhatsApp Cloud] Failed to get MM API eligibility for WABA ${wabaId}:`, err.message || err);
      }
    }

    return result;
  }

  /**
   * MM API for WhatsApp: envía un mensaje de marketing optimizado.
   * https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/onboarding#sending-a-message
   */
  async sendMarketingMessage(
    connectionId: string,
    to: string,
    body: string,
    options?: { messageActivitySharing?: boolean; templateName?: string; languageCode?: string; components?: any[] }
  ): Promise<any> {
    const connection = this.connections.get(connectionId);
    if (!connection) throw new Error('Connection not found');

    const adapter = this.createServiceAdapter(connection);
    return await (adapter as any).sendMarketingMessage(to, body, options);
  }

  async handleWebhook(req: any, res: any): Promise<void> {
    try {
      const body = req.body;

      if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === 'messages') {
              const value = change.value;
              
              if (value.messages && value.messages.length > 0) {
                const message = value.messages[0];
                const phoneId = value.metadata.phone_number_id;

                // Find connection by phone number ID
                const connection = Array.from(this.connections.values()).find(
                  conn => conn.config.phoneNumberId === phoneId
                );

                if (connection) {
                  await this.processIncomingMessage(message, connection);
                }
              }
            }
          }
        }
      }

      res.sendStatus(200);
    } catch (error) {
      console.error('[WhatsApp Cloud] Webhook error:', error);
      res.sendStatus(500);
    }
  }

  async verifyWebhook(req: any, res: any): Promise<void> {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Check against all stored verify tokens
    const isValidToken = Array.from(this.webhookVerifyTokens.values()).includes(token);

    if (mode && token) {
      if (mode === 'subscribe' && isValidToken) {
        console.log('[WhatsApp Cloud] Webhook verified');
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    } else {
      res.sendStatus(400);
    }
  }

  async getConnectionStatus(connectionId: string): Promise<any> {
    const connection = this.connections.get(connectionId);
    if (!connection) return null;

    // MM API for WhatsApp: estado de onboarding de la WABA (best-effort, no bloquea)
    let marketingMessages: any;
    try {
      marketingMessages = await this.getMarketingMessagesEligibility(connectionId);
    } catch (err) {
      marketingMessages = { eligible: false, status: 'UNKNOWN', termsOfServiceSigned: false, checkedAt: new Date() };
    }

    // Verify credentials by making a test API call
    try {
      const url = `https://graph.facebook.com/v21.0/${connection.config.phoneNumberId}`;
      await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${connection.config.accessToken}`,
        },
      });

      return {
        status: 'connected',
        lastChecked: new Date(),
        marketingMessages,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Invalid credentials',
        lastChecked: new Date(),
        marketingMessages,
      };
    }
  }

  private formatPlatformMessage(rawMessage: any): PlatformMessage | null {
    if (!rawMessage) return null;

    const message: PlatformMessage = {
      id: rawMessage.id,
      from: rawMessage.from,
      type: 'text',
      raw: rawMessage,
    };

    if (rawMessage.type === 'text' && rawMessage.text?.body) {
      message.text = rawMessage.text.body;
      message.type = 'text';
    } else if (rawMessage.type === 'image') {
      message.type = 'media';
      message.media = {
        type: 'image',
        url: rawMessage.image?.url,
        caption: rawMessage.image?.caption,
      };
    } else if (rawMessage.type === 'video') {
      message.type = 'media';
      message.media = {
        type: 'video',
        url: rawMessage.video?.url,
        caption: rawMessage.video?.caption,
      };
    } else if (rawMessage.type === 'document') {
      message.type = 'media';
      message.media = {
        type: 'document',
        url: rawMessage.document?.url,
        caption: rawMessage.document?.caption,
      };
    } else if (rawMessage.type === 'interactive') {
      message.type = 'interactive';
      if (rawMessage.interactive?.button_reply) {
        message.interactive = {
          type: 'button_reply',
          button_reply: {
            id: rawMessage.interactive.button_reply.id,
            title: rawMessage.interactive.button_reply.title,
          },
        };
      } else if (rawMessage.interactive?.list_reply) {
        message.interactive = {
          type: 'button_reply',
          button_reply: {
            id: rawMessage.interactive.list_reply.id,
            title: rawMessage.interactive.list_reply.title,
          },
        };
      }
    }

    return message;
  }

  private async updateConnectionStatus(connectionId: string, status: string): Promise<void> {
    await supabase
      .from('platform_connections')
      .update({
        status,
        last_connected_at: status === 'connected' ? new Date().toISOString() : null,
      })
      .eq('id', connectionId);
  }
}

export const whatsappCloudService = new WhatsAppCloudService();
