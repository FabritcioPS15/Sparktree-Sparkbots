import WhatsAppService from '../../../integrations/whatsappService';
import { supabase } from '../../../../core/config/supabase';
import axios from 'axios';
import { executeRAGNode } from '../../../../automation/nodes/knowledge/rag.node';

const PHONE_VAR_KEYWORDS = ['telefono', 'phone', 'celular'];

// Ventana (ms) durante la cual un trigger exacto ya ejecutado para el mismo
// remitente no vuelve a dispararse. Protege de reenvíos involuntarios repetidos
// de la misma palabra clave o de re-procesamiento duplicado del mismo mensaje.
const TRIGGER_DEDUP_WINDOW_MS = 60 * 1000;

// Cache en memoria { senderPhone -> { lastTrigger, executedAt } }.
const lastTriggerCache = new Map<string, { lastTrigger: string; executedAt: number }>();

// Márgenes de limpieza para evitar que el Map crezca sin límite.
const DEDUP_CACHE_MAX = 2000;
const DEDUP_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

const isDuplicateTrigger = (senderPhone: string, triggerLower: string, now: number): boolean => {
  const entry = lastTriggerCache.get(senderPhone);
  if (!entry) return false;
  if (entry.lastTrigger !== triggerLower) return false;
  return now - entry.executedAt < TRIGGER_DEDUP_WINDOW_MS;
};

const rememberTrigger = (senderPhone: string, triggerLower: string, now: number): void => {
  if (lastTriggerCache.size >= DEDUP_CACHE_MAX) {
    for (const [k, v] of lastTriggerCache) {
      if (now - v.executedAt > DEDUP_CACHE_MAX_AGE_MS) lastTriggerCache.delete(k);
    }
  }
  lastTriggerCache.set(senderPhone, { lastTrigger: triggerLower, executedAt: now });
};

// Un nodo de captura cuya variable contenga estas palabras se trata como
// teléfono del contacto: se valida, se extrae del texto y se guarda en phone_number.
const isPhoneVariable = (name: string): boolean => {
  const normalized = (name || '').toLowerCase().replace(/[^a-z]/g, '');
  return PHONE_VAR_KEYWORDS.some((kw) => normalized.includes(kw));
};

// Extrae un teléfono desde texto libre ("mi número es 987 654 321", "+51 987654321").
// Normaliza espacios, guiones y paréntesis. Retorna null si no hay un teléfono válido.
const extractPhoneFromText = (text: string): string | null => {
  const cleaned = text.replace(/[()\-]/g, ' ');
  const match = cleaned.match(/\+?\d[\d\s]{5,13}\d/);
  if (!match) return null;
  const phone = match[0].replace(/\s+/g, '');
  return /^\+?[0-9]{7,15}$/.test(phone) ? phone : null;
};

export async function handleIncomingMessage(
  message: any,
  senderPhone: string,
  organizationConfig: { phoneNumberId?: string; accessToken?: string, organizationId?: string, conversationId?: string, contactId?: string, whatsappConnectionId?: string, senderJid?: string },
  waService: any, // Pass the service instance (Cloud or QR)
  preloadedFlow?: any // Pass a specific flow if one is already resolved
) {

  // Fetch contact to get stored JID if available
  const { data: contactData } = await supabase
    .from('contacts')
    .select('*, custom_attributes')
    .eq('id', organizationConfig.contactId)
    .single();

  const contactJid = organizationConfig.senderJid || (contactData as any)?.custom_attributes?.whatsapp_jid;

  const saveOutgoingMessage = async (type: string, content: any, waResponse: any) => {
    if (organizationConfig.conversationId && organizationConfig.contactId) {
      const { error } = await supabase.from('messages').insert({
        organization_id: organizationConfig.organizationId,
        conversation_id: organizationConfig.conversationId,
        contact_id: organizationConfig.contactId,
        direction: 'outbound',
        type: type,
        content: typeof content === 'string' ? content : JSON.stringify(content),
        status: 'sent',
        whatsapp_message_id: waResponse?.key?.id
      });
      if (error) console.error('[Flow Engine] Error saving outbound message:', error);

      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', organizationConfig.conversationId);
    }
  };

  // Limpia el bot_state de confirmación cuando el usuario responde por botón
// (nativo/número) al nodo confirmation. Evita que el siguiente texto libre se
// siga interpretando como respuesta sí/no de una confirmación ya completada.
const clearConfirmationState = async () => {
  const state = (contactData as any)?.bot_state || '';
  if (state.startsWith('confirmation_')) {
    await supabase
      .from('contacts')
      .update({ bot_state: null })
      .eq('id', organizationConfig.contactId);
  }
};

// --- Historial de nodos para soportar "Volver" ---
  // Se mantiene una pila de nodos de espera (menús/inputs) por contacto en
  // custom_attributes.flow_history. "Volver" hace pop y re-ejecuta el anterior.
  const getFlowHistory = async (): Promise<string[]> => {
    const { data } = await supabase
      .from('contacts')
      .select('custom_attributes')
      .eq('id', organizationConfig.contactId)
      .single();
    const attrs = (data as any)?.custom_attributes || {};
    return Array.isArray(attrs.flow_history) ? attrs.flow_history : [];
  };

  const setFlowHistory = async (history: string[]) => {
    const { data } = await supabase
      .from('contacts')
      .select('custom_attributes')
      .eq('id', organizationConfig.contactId)
      .single();
    const attrs = (data as any)?.custom_attributes || {};
    await supabase
      .from('contacts')
      .update({ custom_attributes: { ...attrs, flow_history: history } })
      .eq('id', organizationConfig.contactId);
  };

  const pushFlowHistory = async (nodeId: string | null, knownHistory?: string[]) => {
    if (!nodeId) return;
    const history = knownHistory || await getFlowHistory();
    if (history[history.length - 1] !== nodeId) {
      history.push(nodeId);
      await setFlowHistory(history);
    }
  };

  // Ejecuta el "volver": saca el nodo actual de la pila y re-ejecuta el
  // anterior (o el menú principal si la pila queda vacía).
  const goBack = async (flow: any, knownHistory?: string[]) => {
    const history = knownHistory || await getFlowHistory();
    let targetNodeId: string | null = null;

    if (history.length > 1) {
      history.pop(); // saca el nodo actual
      targetNodeId = history[history.length - 1] || null; // el anterior
    } else {
      history.pop();
      targetNodeId = null;
    }
    await setFlowHistory(history);

    // Si se estaba esperando una confirmación, salir de ese estado para que el
    // nodo al que se retrocede vuelva a manejar el mensaje normalmente.
    await clearConfirmationState();

    if (targetNodeId) {
      await executeNode(flow, targetNodeId);
    } else {
      // Sin más historial: volver al menú principal (trigger)
      const triggerNode = (flow.nodes || []).find((n: any) => n.type === 'trigger') || (flow.nodes && flow.nodes[0]);
      if (triggerNode) await executeNode(flow, triggerNode.id);
    }
  };

  // Track flow execution start
  const trackFlowExecution = async (flowId: string, triggerWord?: string) => {
    try {
      const { error } = await supabase.from('flow_executions').insert({
        organization_id: organizationConfig.organizationId,
        flow_id: flowId,
        contact_id: organizationConfig.contactId,
        conversation_id: organizationConfig.conversationId,
        trigger_word: triggerWord,
        status: 'started'
      });
      
      if (error) {
        console.error('[Flow Engine] Error tracking flow execution:', error);
      }
    } catch (error) {
      console.error('[Flow Engine] Exception tracking flow execution:', error);
    }
  };

  // Update flow execution status
  const updateFlowExecution = async (flowId: string, status: 'completed' | 'failed' | 'abandoned') => {
    try {
      const { error } = await supabase
        .from('flow_executions')
        .update({ 
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : null
        })
        .eq('organization_id', organizationConfig.organizationId)
        .eq('flow_id', flowId)
        .eq('contact_id', organizationConfig.contactId)
        .eq('status', 'started')
        .is('completed_at', null)
        .order('executed_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('[Flow Engine] Error updating flow execution:', error);
      }
    } catch (error) {
      console.error('[Flow Engine] Exception updating flow execution:', error);
    }
  };

  const executeNode = async (flow: any, nodeId: string) => {
    let currentNodeId: string | null = nodeId;

    while (currentNodeId) {
      console.log(`[Flow Engine] Executing node ID: ${currentNodeId}`);
      
      if (!flow.nodes || !Array.isArray(flow.nodes)) {
        console.error('[Flow Engine] Flow nodes missing or not an array!');
        break;
      }

      const node = flow.nodes.find((n: any) => n.id === currentNodeId);
      if (!node) {
        console.log(`[Flow Engine] Node ${currentNodeId} not found in flow definition!`);
        break;
      }
      console.log(`[Flow Engine] Node type: ${node.type}`);
      
      // Check for conversion node / potential lead
      if (node.data?.isConversionNode) {
        console.log(`[Flow Engine] Conversion node hit! Marking contact ${organizationConfig.contactId} as potential lead.`);
        try {
          const currentAttributes = (contactData as any)?.custom_attributes || {};
          await supabase
            .from('contacts')
            .update({ 
               custom_attributes: { ...currentAttributes, is_potential_lead: true },
               // We could also add a dedicated column if it existed, but custom_attributes is safe
            })
            .eq('id', organizationConfig.contactId);
        } catch (error) {
          console.error('[Flow Engine] Error marking potential lead:', error);
        }
      }

      if (node.type === 'trigger') {
        console.log(`[Flow Engine] Trigger node detected. Proceeding to connected block.`);
        // Al llegar al menú principal se reinicia el historial de "volver".
        try { await setFlowHistory([]); } catch (e) {}
      } else if (node.type === 'text') {
        try {
          console.log(`[Flow Engine] Sending text message: "${node.data?.text}" to ${senderPhone} (JID: ${contactJid || 'using phone'})`);
          const res = await waService.sendTextMessage(senderPhone, node.data?.text || '', { jid: contactJid });
          console.log(`[Flow Engine] Text message sent successfully. Response:`, res?.key ? 'OK' : 'Unknown');
          await saveOutgoingMessage('text', node.data?.text, res);
        } catch (error) {
          console.error(`[Flow Engine] ERROR sending text message:`, error);
        }
      } else if (node.type === 'interactive') {
        const history = await getFlowHistory();
        try {
          console.log(`[Flow Engine] Sending interactive message to ${senderPhone}`);
          const res = await waService.sendButtonMessage(
            senderPhone,
            node.data?.bodyText || '',
            node.data?.buttons || [],
            { jid: contactJid, showBackButton: history.length > 0, backButtonLabel: '↩ Volver' }
          );
          console.log(`[Flow Engine] Interactive message sent. Button mapping:`, res.buttonMapping);
          
          await saveOutgoingMessage('text', { 
            buttonMapping: res?.buttonMapping,
            bodyText: node.data?.bodyText,
            isNumericButtons: !!res?.isNumericButtons,
            buttons: (node.data?.buttons || []).map((b: any, i: number) => ({
              id: b.id || `btn_${i}`,
              text: b.text || b.title || `Opción ${i + 1}`,
            })),
          }, res);
          console.log(`[Flow Engine] Interactive message database save completed.`);
        } catch (error) {
          console.error(`[Flow Engine] ERROR sending or saving interactive message:`, error);
        }
        await pushFlowHistory(currentNodeId, history);
        break; // Wait for user button click
      } else if (node.type === 'confirmation') {
        // Nodo de confirmación Sí/No. Reutiliza el sistema interactivo (botones
        // quick-reply) para que el botón "Volver", la respuesta por número en QR
        // y los botones nativos de Cloud API resuelvan los edges con los handles
        // confirm_yes / confirm_no. Adicionalmente responde a texto libre "sí"/"no"
        // vía el bot_state confirmation_<nodeId> (ver manejo de texto más abajo).
        const history = await getFlowHistory();
        const yesLabel = node.data?.yesLabel || '✅ Sí';
        const noLabel = node.data?.noLabel || '❌ No';
        const confirmationButtons = [
          { id: 'confirm_yes', title: yesLabel, text: yesLabel },
          { id: 'confirm_no', title: noLabel, text: noLabel },
        ];

        await supabase
          .from('contacts')
          .update({ bot_state: `confirmation_${currentNodeId}` })
          .eq('id', organizationConfig.contactId)
          .eq('organization_id', organizationConfig.organizationId);

        try {
          console.log(`[Flow Engine] Sending confirmation message to ${senderPhone}`);
          const question = node.data?.bodyText || node.data?.question || '¿Confirmas esta acción?';
          const res = await waService.sendButtonMessage(
            senderPhone,
            question,
            confirmationButtons,
            { jid: contactJid, showBackButton: history.length > 0, backButtonLabel: '↩ Volver' }
          );
          console.log(`[Flow Engine] Confirmation message sent. Button mapping:`, res.buttonMapping);

          await saveOutgoingMessage('text', {
            buttonMapping: res?.buttonMapping,
            bodyText: question,
            isNumericButtons: !!res?.isNumericButtons,
            buttons: confirmationButtons.map((b) => ({ id: b.id, text: b.title })),
          }, res);
          console.log(`[Flow Engine] Confirmation message database save completed.`);
        } catch (error) {
          console.error(`[Flow Engine] ERROR sending or saving confirmation message:`, error);
        }
        await pushFlowHistory(currentNodeId, history);
        break; // Wait for Sí/No reply
      } else if (node.type === 'media') {
        const url = node.data?.mediaUrl;
        const caption = node.data?.caption;
        const type = node.data?.mediaType || 'image';
        
        if (url) {
          console.log(`[Flow Engine] Sending media (${type}): ${url}`);
          const res = await waService.sendMediaMessage(senderPhone, url, { 
            jid: contactJid,
            caption: caption,
            type: type,
            fileName: node.data?.fileName,
            viewOnce: !!node.data?.isViewOnce
          });
          await saveOutgoingMessage('media', { url, caption, type, fileName: node.data?.fileName, viewOnce: !!node.data?.isViewOnce }, res);
        }
      } else if (node.type === 'capture' || node.type === 'capture_phone') {
        const question = node.data?.question || (node.type === 'capture_phone' ? 'Por favor, ingresa tu número de celular:' : '?');
        const res = await waService.sendTextMessage(senderPhone, question, { jid: contactJid });
        await saveOutgoingMessage('capture', node.data?.question, res);
        await supabase
          .from('contacts')
          .update({ bot_state: `capture_${currentNodeId}` })
          .eq('id', organizationConfig.contactId)
          .eq('organization_id', organizationConfig.organizationId);
        break; // Wait for user text input
      } else if (node.type === 'webhook') {
        try {
          await axios({
            method: node.data?.method || 'POST',
            url: node.data?.url,
            data: {
              contactPhone: senderPhone,
              contactId: organizationConfig.contactId
            }
          });
        } catch (error) {
          console.error('Webhook node failed:', error);
        }
      } else if (node.type === 'handoff') {
        // Enviar mensaje de despedida/transferencia configurado en el nodo.
        const handoffMsg = node.data?.message || 'Te conecto con un asesor humano, en un momento te atiende.';
        try {
          const res = await waService.sendTextMessage(senderPhone, handoffMsg, { jid: contactJid });
          await saveOutgoingMessage('text', handoffMsg, res);
        } catch (error) {
          console.error(`[Flow Engine] ERROR sending handoff message:`, error);
        }
        await supabase
          .from('contacts')
          .update({ bot_state: 'handoff' })
          .eq('id', organizationConfig.contactId)
          .eq('organization_id', organizationConfig.organizationId);
        break; // Pause bot
      } else if (node.type === 'delay') {
        const waitTime = (node.data?.delaySeconds || 3) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else if (node.type === 'knowledge_retrieval') {
        try {
          // Extract query from message
          const query = message?.text?.body || message?.content || '';
          console.log(`[Flow Engine] Executing RAG node for query: "${query}"`);
          const ragResult = await executeRAGNode(
            node.data || {},
            {
              query: query,
              organizationId: organizationConfig.organizationId,
              whatsappConnectionId: organizationConfig.whatsappConnectionId,
              conversationId: organizationConfig.conversationId,
            }
          );
          
          console.log(`[Flow Engine] RAG retrieved ${ragResult.sources.length} sources`);
          
          // Store RAG result in contact metadata for use in subsequent nodes
          const currentAttributes = (contactData as any)?.custom_attributes || {};
          await supabase
            .from('contacts')
            .update({
              custom_attributes: {
                ...currentAttributes,
                rag_context: ragResult.context,
                rag_sources: ragResult.sources,
                rag_query: ragResult.query,
              }
            })
            .eq('id', organizationConfig.contactId);
            
          console.log(`[Flow Engine] RAG context stored in contact metadata`);
        } catch (error) {
          console.error('[Flow Engine] RAG node failed:', error);
        }
      }

      // Find next node
      const nextEdge = (flow.edges || []).find((e: any) => e.source === currentNodeId);
      if (nextEdge && nextEdge.target && !['interactive', 'capture', 'handoff'].includes(node.type)) {
        console.log(`[Flow Engine] Moving to next node via edge: ${nextEdge.id} -> ${nextEdge.target}`);
        currentNodeId = nextEdge.target;
      } else {
        console.log(`[Flow Engine] Flow execution stopped at node ${currentNodeId} (No valid next edge found or waiting for user input).`);
        currentNodeId = null;
      }
    }
  };

  // Resuelve el flow activo paralelizando las consultas de flujo.
  // Order: asignación por conexión → is_active → status='active' (fallback).
  const resolveFlow = async (): Promise<any> => {
    if (preloadedFlow) {
      return preloadedFlow;
    }

    let flow: any = null;

    if (organizationConfig.whatsappConnectionId) {
      const { data: assignments } = await supabase
        .from('flow_assignments')
        .select(`flows!inner(*)`)
        .eq('whatsapp_connection_id', organizationConfig.whatsappConnectionId)
        .eq('is_active', true);
      if (assignments && assignments.length > 0) {
        flow = assignments[0].flows;
        console.log(`[Bot Engine] Specific flow assignment found: ${flow.name}`);
      }
    }

    if (flow) return flow;

    // Consultar is_active y status en paralelo (único round-trip de red)
    const [activeResult, statusResult] = await Promise.all([
      supabase
        .from('flows')
        .select('*')
        .eq('organization_id', organizationConfig.organizationId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('flows')
        .select('*')
        .eq('organization_id', organizationConfig.organizationId)
        .eq('status', 'active')
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    flow = activeResult.data || statusResult.data || null;
    if (flow) {
      console.log(`[Bot Engine] Using ${activeResult.data ? 'is_active' : "status='active'"} default organization flow: ${flow.name}`);
    }
    return flow;
  };

  if (message.type === 'text') {
    if (!message?.text?.body) {
      console.log(`[Bot Engine] Received text message with no body (maybe empty or unsupported type). Skipping bot processing.`);
      return;
    }

    const textBody = message.text.body.trim();
    const textLower = textBody.toLowerCase();
    console.log(`[Bot Engine] Processing text message: "${textBody}" from ${senderPhone}`);

    // Reutiliza el contacto ya consultado al inicio (evita una query extra).
    const contact = contactData as any;

    // ── AUTO-REACTIVACIÓN ────────────────────────────────────────────────────
    // Si la persona vuelve a escribir después de 24h sin interacción, se reinicia
    // el estado del bot (sale de handoff/captura y limpia el historial de "Volver")
    // para que el flujo arranque de nuevo desde el menú principal.
    const isPausedState = contact?.bot_state === 'handoff' || (contact?.bot_state && (contact.bot_state.startsWith('capture_') || contact.bot_state.startsWith('confirmation_')));
    const hasFlowHistory = Array.isArray(contact?.custom_attributes?.flow_history) && contact.custom_attributes.flow_history.length > 0;
    if (isPausedState || hasFlowHistory) {
      const { data: recentMsgs } = await supabase
        .from('messages')
        .select('created_at')
        .eq('conversation_id', organizationConfig.conversationId)
        .order('created_at', { ascending: false })
        .limit(2);
      // El mensaje actual ya quedó guardado antes de entrar al bot: la interacción
      // previa real es el elemento [1] de la lista descendente.
      const prevInteraction = recentMsgs && recentMsgs.length > 1
        ? new Date((recentMsgs as any)[1].created_at).getTime()
        : 0;
      const INACTIVITY_RESET_MS = 24 * 60 * 60 * 1000;
      if (prevInteraction > 0 && Date.now() - prevInteraction >= INACTIVITY_RESET_MS) {
        console.log(`[Bot Engine] Contacto ${senderPhone} inactivo >24h. Reiniciando estado del bot (reactivación).`);
        const currentAttributes = contact.custom_attributes || {};
        await supabase
          .from('contacts')
          .update({
            bot_state: null,
            custom_attributes: { ...currentAttributes, flow_history: [] }
          })
          .eq('id', organizationConfig.contactId);
        contact.bot_state = null;
        contact.custom_attributes = { ...currentAttributes, flow_history: [] };
      }
    }

    // Check if in handoff
    if (contact?.bot_state === 'handoff') {
      console.log(`[Bot Engine] Contact ${senderPhone} is in handoff mode. Bot is paused for connection ${organizationConfig.whatsappConnectionId}.`);
      return; // Bot is silent, human agent is handling
    }

    // Get active flow
    const flow = await resolveFlow();

    if (!flow) {
      console.log(`[Bot Engine] No active flow found for sender ${senderPhone} (Connection: ${organizationConfig.whatsappConnectionId})`);
      return;
    } else {
      console.log(`[Bot Engine] Active flow for processing: ${flow.name} (ID: ${flow.id})`);
    }

    // Check if waiting for capture input
    if (contact?.bot_state?.startsWith('capture_')) {
      const nodeId = contact.bot_state.replace('capture_', '');
      const node = flow.nodes.find((n: any) => n.id === nodeId);
      
      if (node) {
        console.log(`[Bot Engine] Capture mode active for node: ${nodeId}. Input: "${textBody}"`);
        
        // Validation logic
        const valType = node.data?.validationType || 'any';
        const variableName = node.data?.variableName || `var_${nodeId}`;
        const isPhoneField = isPhoneVariable(variableName);
        let isValid = true;
        let savedValue = textBody;

        if (valType === 'email') {
          isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(textLower);
        } else if (valType === 'number') {
          isValid = !isNaN(Number(textBody));
        } else if (valType === 'phone' || isPhoneField) {
          const extracted = extractPhoneFromText(textBody);
          isValid = !!extracted;
          if (extracted) savedValue = extracted;
        }

        // Allow Skip logic
        const isSkip = node.data?.allowSkip && (textLower === 'saltar' || textLower === 'skip' || textLower === 'omitir');

        if (isValid || isSkip) {
          console.log(`[Bot Engine] Input valid or skipped. Saving variable: ${variableName}`);
          
          // Persistence: Save to custom_attributes
          const currentAttributes = contact.custom_attributes || {};
          
          if (!isSkip) {
            currentAttributes[variableName] = savedValue;
          }

          // Si la variable capturada es el teléfono, guardarlo también como el número
          // real del contacto (los contactos LID no traen número de WhatsApp).
          const updatePayload: any = {
            custom_attributes: currentAttributes,
            bot_state: null // Clear state
          };
          if (isPhoneField && !isSkip && isValid) {
            updatePayload.phone_number = savedValue;
          }

          await supabase
            .from('contacts')
            .update(updatePayload)
            .eq('id', organizationConfig.contactId)
            .eq('organization_id', organizationConfig.organizationId);

          // Continue flow
          const nextEdge = flow.edges.find((e: any) => e.source === nodeId);
          if (nextEdge && nextEdge.target) {
            await executeNode(flow, nextEdge.target);
          }
          return;
        } else {
          // Send error message
          const errorMsg = node.data?.errorMessage || 'Ese dato no parece válido. Intenta de nuevo por favor:';
          const res = await waService.sendTextMessage(senderPhone, errorMsg, { jid: contactJid });
          await saveOutgoingMessage('text', errorMsg, res);
          return;
        }
      }
    }

    // ── CONFIRMACIÓN: responder por texto libre "sí"/"no" ───────────────────
    // Cuando el bot espera confirmación (bot_state confirmation_<nodeId>), se
    // acepta texto libre equivalente a sí/no (además del botón rápido). Si la
    // respuesta no es clara, se re-envía la pregunta para reintentar.
    if (contact?.bot_state?.startsWith('confirmation_')) {
      const nodeId = contact.bot_state.replace('confirmation_', '');
      const node = flow.nodes.find((n: any) => n.id === nodeId);

      if (node) {
        const trimmed = textBody.trim();
        const trimmedLower = trimmed.toLowerCase();
        const isYes = /^(s[ií]|yes|ok|okay|dale|acepto|confirmo|siempre)$/.test(trimmedLower) || trimmed === '1';
        const isNo = /^(no|nop|nope)$/.test(trimmedLower) || trimmed === '2';

        if (isYes || isNo) {
          console.log(`[Bot Engine] Confirmation "${isYes ? 'Sí' : 'No'}" received from ${senderPhone}`);
          await supabase
            .from('contacts')
            .update({ bot_state: null })
            .eq('id', organizationConfig.contactId);

          const sourceHandle = isYes ? 'confirm_yes' : 'confirm_no';
          const edge =
            flow.edges.find((e: any) => e.source === nodeId && e.sourceHandle === sourceHandle) ||
            flow.edges.find((e: any) => e.sourceHandle === sourceHandle && e.source === nodeId) ||
            flow.edges.find((e: any) => e.source === nodeId);

          if (edge && edge.target) {
            await executeNode(flow, edge.target);
          } else {
            console.log(`[Bot Engine] No edge found for confirmation handle: ${sourceHandle}`);
          }
          return;
        }

        // Re-intento: mensaje aclaratorio + reenvío de los botones Sí/No.
        const retryMsg = node.data?.retryMessage || 'Por favor responde Sí o No para continuar:';
        const retryRes = await waService.sendTextMessage(senderPhone, retryMsg, { jid: contactJid });
        await saveOutgoingMessage('text', retryMsg, retryRes);

        const yesLabel = node.data?.yesLabel || '✅ Sí';
        const noLabel = node.data?.noLabel || '❌ No';
        const confirmationButtons = [
          { id: 'confirm_yes', title: yesLabel, text: yesLabel },
          { id: 'confirm_no', title: noLabel, text: noLabel },
        ];
        const question = node.data?.bodyText || node.data?.question || '¿Confirmas esta acción?';
        try {
          const res = await waService.sendButtonMessage(senderPhone, question, confirmationButtons, { jid: contactJid });
          await saveOutgoingMessage('text', {
            buttonMapping: res?.buttonMapping,
            bodyText: question,
            isNumericButtons: !!res?.isNumericButtons,
            buttons: confirmationButtons.map((b) => ({ id: b.id, text: b.title })),
          }, res);
        } catch (error) {
          console.error(`[Flow Engine] ERROR re-sending confirmation message:`, error);
        }
        return;
      }
    }

    // Get trigger node configuration
    const triggerNode = (flow.nodes || []).find((n: any) => n.type === 'trigger') || (flow.nodes && flow.nodes[0]);
    const strategy = triggerNode?.data?.matchingStrategy || 'flexible';
    const waitTimeMin = triggerNode?.data?.reactivationTime || 30;

    // PRIORITY 1: Handle Numeric Button replies (Interactive flow continuation)
    if (message.isNumericButtonResponse) {
      const buttonNumber = message.buttonNumber;
      console.log(`[Bot Engine] Processing numeric button response: ${buttonNumber}`);

      // Get the last outbound text messages to find the one with button mapping payload
      const { data: lastMessages } = await supabase
        .from('messages')
        .select('content')
        .eq('conversation_id', organizationConfig.conversationId)
        .eq('direction', 'outbound')
        .order('created_at', { ascending: false })
        .limit(10);

      let interactiveData = null;
      if (lastMessages) {
        for (const msg of lastMessages) {
          try {
            const parsed = JSON.parse(msg.content);
            if (parsed && parsed.buttonMapping) {
              interactiveData = parsed;
              break;
            }
          } catch (e) {}
        }
      }

      if (interactiveData) {
        try {
          console.log(`[Flow Engine] Found interactive data:`, interactiveData);
          
          if (interactiveData.buttonMapping && interactiveData.buttonMapping[buttonNumber]) {
            const buttonId = interactiveData.buttonMapping[buttonNumber];
            console.log(`[Flow Engine] Mapped numeric ${buttonNumber} to button ID: ${buttonId}`);

            // Opción "Volver": re-ejecuta el nodo anterior del historial.
            if (buttonId === 'btn_back') {
              console.log(`[Flow Engine] "Volver" detected, going back in history`);
              await goBack(flow);
              return;
            }

            if (flow && flow.edges) {
              const edge = flow.edges.find((e: any) => e.sourceHandle === buttonId || e.source === buttonId);
              if (edge && edge.target) {
                console.log(`[Flow Engine] Found edge: ${edge.id}, moving to node: ${edge.target}`);
                await clearConfirmationState();
                await executeNode(flow, edge.target);
                // Mark as completed when flow finishes naturally (or update state)
                await updateFlowExecution(flow.id, 'completed');
                return;
              } else {
                console.log(`[Flow Engine] No edge found for button ID: ${buttonId}`);
              }
            }
          } else {
            console.log(`[Flow Engine] No button mapping found for number: ${buttonNumber}`);
            console.log(`[Flow Engine] Available mappings:`, interactiveData.buttonMapping);
          }
        } catch (parseError) {
          console.log(`[Flow Engine] Error processing button mapping:`, parseError);
        }
      } else {
        console.log(`[Flow Engine] No recent interactive message found for conversation ${organizationConfig.conversationId}`);
      }

      console.log(`[Flow Engine] Could not process numeric response as button, continuing to fallback`);
    }

    // REACTIVATION TIMER CHECK (Applies only to new flow triggers)
    const { data: lastExec } = await supabase
      .from('flow_executions')
      .select('executed_at')
      .eq('contact_id', organizationConfig.contactId)
      .eq('conversation_id', organizationConfig.conversationId)
      .eq('flow_id', flow.id)
      .order('executed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastExec) {
      const lastExecTime = new Date(lastExec.executed_at).getTime();
      const now = new Date().getTime();
      const diffMin = (now - lastExecTime) / (1000 * 60);
      
      if (diffMin < waitTimeMin) {
        console.log(`[Bot Engine] Blocking reactivation for flow "${flow.name}". User ${senderPhone} last executed ${Math.round(diffMin)}m ago (Threshold: ${waitTimeMin}m)`);
        return; 
      }
    }

    // PRIORITY 2: Check if this is a trigger for starting the flow
    let matchedTrigger: string | null = null;
    
    if (flow.triggers && Array.isArray(flow.triggers) && flow.triggers.length > 0) {
      matchedTrigger = flow.triggers.find((trigger: string) => {
        if (!trigger) return false;
        const triggerLower = trigger.toLowerCase().trim();
        
        if (strategy === 'strict') {
          // Exact match (ignoring only outer spaces)
          return textLower === triggerLower;
        } else {
          // Flexible match (presence in text)
          return textLower.includes(triggerLower);
        }
      }) || null;
    } else {
      // Catch-all
      matchedTrigger = textBody;
    }

    if (matchedTrigger) {
      console.log(`[Bot Engine] Trigger matched (${strategy}): "${matchedTrigger}"`);

      // ── COOLDOWN DE TRIGGER ────────────────────────────────────────────────
      // Si el contacto envía la misma palabra clave repetida dentro de la ventana
      // (p.ej. reenvía "info" o el mismo mensaje llega duplicado), no se re-dispara
      // el flujo de nuevo para evitar mensajes repetidos con todo el protocolo.
      const now = Date.now();
      if (isDuplicateTrigger(senderPhone, matchedTrigger.toLowerCase().trim(), now)) {
        console.log(`[Bot Engine] Duplicate trigger "${matchedTrigger}" from ${senderPhone} within cooldown. Skipping to avoid spam.`);
        return;
      }
      rememberTrigger(senderPhone, matchedTrigger.toLowerCase().trim(), now);

      await trackFlowExecution(flow.id, matchedTrigger);
      
      if (triggerNode) {
        await executeNode(flow, triggerNode.id);
        await updateFlowExecution(flow.id, 'completed');
        return;
      }
    }

    // PRIORITY 3: Fallback if no trigger matched and not a valid button response
    if (strategy === 'strict') {
      console.log('[Bot Engine] No trigger matched in Strict mode. Staying quiet.');
      return;
    }
    
    console.log('[Bot Engine] No trigger matched. Sending fallback message.');
    const fallbackText = 'No entendí ese comando. Intenta con otras palabras clave configuradas en tus Flujos.';
    const res = await waService.sendTextMessage(senderPhone, fallbackText, { jid: contactJid });
    await saveOutgoingMessage('text', fallbackText, res);
  }

  // Handle Interactive Button replies (native button_reply or list_reply)
  if (message.type === 'interactive') {
    const buttonId = message.interactive?.button_reply?.id ||
      message.interactive?.list_reply?.id ||
      message.interactive?.id;

    let flow = preloadedFlow;
    if (!flow) {
      flow = await resolveFlow();
    }

    // Opción "Volver": re-ejecuta el nodo anterior del historial.
    if (buttonId === 'btn_back' && flow) {
      console.log(`[Flow Engine] "Volver" detected (interactive), going back in history`);
      await goBack(flow);
      return;
    }

    if (flow && flow.edges) {
      const edge = flow.edges.find((e: any) => e.sourceHandle === buttonId || e.source === buttonId);
      if (edge && edge.target) {
        await clearConfirmationState();
        await executeNode(flow, edge.target);
        // Mark as completed when flow finishes naturally
        await updateFlowExecution(flow.id, 'completed');
        return;
      }
    }

    const fallbackText = 'Opción no reconocida o flujo incompleto.';
    const res = await waService.sendTextMessage(senderPhone, fallbackText, { jid: contactJid });
    await saveOutgoingMessage('text', fallbackText, res);
  }
}
