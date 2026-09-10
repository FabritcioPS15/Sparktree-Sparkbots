import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, CheckCheck, Smile, Mic,
  Image, Globe, UserCheck, Clock,
  X, RotateCcw, Maximize2, Minimize2
} from 'lucide-react';


interface FlowSimulatorProps {
  nodes: any[];
  edges: any[];
  matchingStrategy?: 'strict' | 'flexible';
  onClose: () => void;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot' | 'system';
  timestamp: string;
  type?: 'text' | 'media' | 'interactive' | 'webhook' | 'handoff' | 'delay' | 'capture' | 'error';
  buttons?: { id: string; title: string; text?: string }[];
  mediaUrl?: string;
  mediaCaption?: string;
  variableName?: string;
  delaySeconds?: number;
  webhookUrl?: string;
}

const NODE_LABELS: Record<string, string> = {
  trigger:     'Disparador',
  text:        'Mensaje',
  interactive: 'Botones',
  confirmation: 'Confirmación',
  media:       'Media',
  capture:     'Captura',
  capture_phone: 'Capturar Celular',
  condition:   'Condición',
  delay:       'Espera',
  webhook:     'Webhook',
  handoff:     'Agente',
  llm:         'IA Completa',
  knowledge_retrieval: 'Base Conocimiento',
};

export const FlowSimulator: React.FC<FlowSimulatorProps> = ({ nodes, edges, matchingStrategy = 'strict', onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: '¡Hola! Escribe una palabra clave configurada para iniciar el flujo.',
      sender: 'bot',
      type: 'text',
      timestamp: now(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [waitingForCaptureNodeId, setWaitingForCaptureNodeId] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [capturedVars, setCapturedVars] = useState<Record<string, string>>({});
  const [flowStarted, setFlowStarted] = useState(false);
  const [delayCountdown, setDelayCountdown] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  function now() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const addMessage = (msg: Omit<Message, 'id'>) => {
    setMessages(prev => [...prev, { id: `msg_${Date.now()}_${Math.random()}`, ...msg }]);
  };

  const executeNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setActiveNodeId(nodeId);
    setIsTyping(true);

    const delayForTyping = node.type === 'delay' ? 600 : 1100;

    setTimeout(() => {
      setIsTyping(false);
      const ts = now();

      if (node.type === 'text') {
        addMessage({ text: node.data.text || '(sin texto)', sender: 'bot', type: 'text', timestamp: ts });
        const next = edges.find(e => e.source === nodeId);
        if (next?.target) setTimeout(() => executeNode(next.target), 1200);
        else setActiveNodeId(null);

      } else if (node.type === 'interactive') {
        addMessage({
          text: node.data.bodyText || '',
          sender: 'bot',
          type: 'interactive',
          timestamp: ts,
          buttons: node.data.buttons || [],
        });

      } else if (node.type === 'confirmation') {
        addMessage({
          text: node.data.bodyText || node.data.question || '¿Confirmas esta acción?',
          sender: 'bot',
          type: 'interactive',
          timestamp: ts,
          buttons: [
            { id: 'confirm_yes', title: node.data.yesLabel || '✅ Sí', text: node.data.yesLabel || '✅ Sí' },
            { id: 'confirm_no', title: node.data.noLabel || '❌ No', text: node.data.noLabel || '❌ No' },
          ],
        });
      } else if (node.type === 'media') {
        addMessage({
          text: node.data.caption || '',
          sender: 'bot',
          type: 'media',
          timestamp: ts,
          mediaUrl: node.data.mediaUrl || '',
          mediaCaption: node.data.caption || '',
        });
        const next = edges.find(e => e.source === nodeId);
        if (next?.target) setTimeout(() => executeNode(next.target), 1200);
        else setActiveNodeId(null);

      } else if (node.type === 'capture' || node.type === 'capture_phone') {
        addMessage({
          text: node.data.question || (node.type === 'capture_phone' ? 'Por favor, ingresa tu número de celular:' : 'Por favor ingresa un dato:'),
          sender: 'bot',
          type: 'capture',
          timestamp: ts,
          variableName: node.data.variableName || (node.type === 'capture_phone' ? 'telefono' : undefined),
        });
        setWaitingForCaptureNodeId(nodeId);

      } else if (node.type === 'delay') {
        const secs = Math.min(node.data.delaySeconds || 3, 10); // cap at 10s in simulator
        addMessage({
          text: `Espera ${node.data.delaySeconds >= 60
            ? `${(node.data.delaySeconds / 60).toFixed(1)} min`
            : `${node.data.delaySeconds || 3} seg`} (simulado en ${secs}s)`,
          sender: 'system',
          type: 'delay',
          timestamp: ts,
          delaySeconds: secs,
        });
        setDelayCountdown(secs);

        let remaining = secs;
        const intervalId = setInterval(() => {
          remaining--;
          setDelayCountdown(remaining);
          if (remaining <= 0) {
            clearInterval(intervalId);
            setDelayCountdown(null);
            const next = edges.find(e => e.source === nodeId);
            if (next?.target) executeNode(next.target);
            else setActiveNodeId(null);
          }
        }, 1000);

      } else if (node.type === 'condition') {
        const varName = node.data.variable;
        const operator = node.data.operator || 'exists';
        const compValue = node.data.value || '';
        const capturedValue = varName ? capturedVars[varName] : undefined;
        let result = false;

        switch (operator) {
          case 'exists': result = capturedValue !== undefined && capturedValue !== ''; break;
          case 'empty': result = capturedValue === undefined || capturedValue === ''; break;
          case 'equals': result = capturedValue === compValue; break;
          case 'notEquals': result = capturedValue !== compValue; break;
          case 'contains': result = capturedValue?.includes(compValue) || false; break;
          case 'greaterThan': result = parseFloat(capturedValue || '0') > parseFloat(compValue); break;
          case 'lessThan': result = parseFloat(capturedValue || '0') < parseFloat(compValue); break;
        }

        addMessage({
          text: `🧪 Condición: @${varName} ${operator} ${compValue ? `"${compValue}"` : ''} → ${result ? '✅ Sí' : '❌ No'}`,
          sender: 'system',
          type: 'text',
          timestamp: ts,
        });

        const nextEdge = edges.find(e => e.source === nodeId && e.sourceHandle === (result ? 'true' : 'false'));
        if (nextEdge?.target) setTimeout(() => executeNode(nextEdge.target), 800);
        else setActiveNodeId(null);

      } else if (node.type === 'webhook') {
        addMessage({
          text: `Llamando a ${node.data.url || 'tu API'}...`,
          sender: 'system',
          type: 'webhook',
          timestamp: ts,
          webhookUrl: node.data.url,
        });
        setTimeout(() => {
          addMessage({
            text: `✅ Webhook (${node.data.method || 'POST'}) ejecutado correctamente. Respuesta simulada: { "status": "ok" }`,
            sender: 'system',
            type: 'webhook',
            timestamp: now(),
          });
          const next = edges.find(e => e.source === nodeId);
          if (next?.target) setTimeout(() => executeNode(next.target), 800);
          else setActiveNodeId(null);
        }, 1500);

      } else if (node.type === 'handoff') {
        const msg = node.data.message || 'Un agente humano atenderá tu caso pronto.';
        addMessage({ text: msg, sender: 'bot', type: 'handoff', timestamp: ts });
        setTimeout(() => {
          addMessage({
            text: '🔔 Agente humano notificado. La automatización se ha pausado.',
            sender: 'system',
            type: 'handoff',
            timestamp: now(),
          });
          setActiveNodeId(null);
        }, 900);

      } else if (node.type === 'knowledge_retrieval') {
        const kbId = node.data.knowledgeBaseId || 'default';
        const queryTemplate = node.data.queryTemplate || '{{message}}';
        const query = queryTemplate.replace(/\{\{message\}\}/g, 'consulta general')
          .replace(/\{\{(\w+)\}\}/g, (_: string, v: string) => capturedVars[v] || `@${v}`);

        addMessage({
          text: `🔍 Buscando en base de conocimiento "${kbId}": "${query}"`,
          sender: 'system',
          type: 'text',
          timestamp: ts,
        });

        setTimeout(() => {
          const mockContext = [
            { content: 'Nuestros productos incluyen camisetas, tazas y gorras personalizadas.', similarity: 0.92, title: 'Catálogo' },
            { content: 'Los precios van desde $9.99 para planes básicos hasta $29.99 para premium.', similarity: 0.78, title: 'Precios' },
          ];

          const contextStr = mockContext.map(s => s.content).join('\n');
          const sourcesStr = mockContext.map(s => `- ${s.title} (${Math.round(s.similarity * 100)}%)`).join('\n');

          setCapturedVars(prev => ({
            ...prev,
            rag_context: contextStr,
            rag_sources: sourcesStr,
          }));

          addMessage({
            text: `✅ Base de conocimiento consultada: ${mockContext.length} resultados encontrados`,
            sender: 'system',
            type: 'text',
            timestamp: now(),
          });

          const next = edges.find(e => e.source === nodeId);
          if (next?.target) setTimeout(() => executeNode(next.target), 800);
          else setActiveNodeId(null);
        }, 1200);

      } else if (node.type === 'llm') {
        const provider = node.data.provider || 'openai';
        const model = node.data.model || 'gpt-4o-mini';

        addMessage({
          text: `🤖 Consultando ${provider}/${model}...`,
          sender: 'system',
          type: 'text',
          timestamp: ts,
        });

        setTimeout(() => {
          const mockResponse = `[Simulación ${provider}/${model}]\n\n` +
            (capturedVars.rag_context
              ? `Basado en la información recuperada:\n${capturedVars.rag_context.substring(0, 200)}...\n\n`
              : '') +
            `Esta es una respuesta simulada del LLM. En producción, se enviaría a la API de ${provider} con el prompt del sistema y del usuario configurados.`;

          addMessage({
            text: mockResponse,
            sender: 'bot',
            type: 'text',
            timestamp: now(),
          });

          setCapturedVars(prev => ({ ...prev, llm_response: mockResponse }));

          const next = edges.find(e => e.source === nodeId);
          if (next?.target) setTimeout(() => executeNode(next.target), 800);
          else setActiveNodeId(null);
        }, 2000);
      }
    }, delayForTyping);
  }, [nodes, edges]);

  const handleReset = () => {
    setMessages([{
      id: 'welcome',
      text: '¡Hola! Escribe una palabra clave configurada para iniciar el flujo.',
      sender: 'bot',
      type: 'text',
      timestamp: now(),
    }]);
    setInputValue('');
    setIsTyping(false);
    setWaitingForCaptureNodeId(null);
    setActiveNodeId(null);
    setCapturedVars({});
    setFlowStarted(false);
    setDelayCountdown(null);
    inputRef.current?.focus();
  };

  const handleSendText = (text: string) => {
    if (!text.trim()) return;
    const ts = now();
    addMessage({ id: `usr_${Date.now()}`, text, sender: 'user', type: 'text', timestamp: ts } as any);
    setInputValue('');

    if (waitingForCaptureNodeId) {
      const captureNode = nodes.find(n => n.id === waitingForCaptureNodeId);
      const varName = captureNode?.data?.variableName;
      if (varName) setCapturedVars(prev => ({ ...prev, [varName]: text }));

      setTimeout(() => {
        addMessage({
          text: `✅ Dato guardado${varName ? ` en @${varName}` : ''}: "${text}"`,
          sender: 'system',
          type: 'capture',
          timestamp: now(),
        });
        setWaitingForCaptureNodeId(null);
        if (captureNode) {
          const next = edges.find((e: any) => e.source === captureNode.id);
          if (next?.target) setTimeout(() => executeNode(next.target), 600);
          else setActiveNodeId(null);
        }
      }, 400);
      return;
    }

    const textLower = text.toLowerCase().trim();
    const triggerNode = nodes.find((n: any) =>
      n.type === 'trigger' &&
      n.data?.keywords?.some((k: string) => {
        const kLower = k.toLowerCase();
        if (matchingStrategy === 'strict') {
          return textLower === kLower;
        }
        // flexible: keyword anywhere in the message
        return textLower.includes(kLower);
      })
    );

    if (triggerNode) {
      setFlowStarted(true);
      const firstEdge = edges.find((e: any) => e.source === triggerNode.id);
      if (firstEdge?.target) setTimeout(() => executeNode(firstEdge.target), 700);
    } else {
      setTimeout(() => {
        addMessage({
          text: '🤖 Mensaje ignorado por el bot',
          sender: 'system',
          type: 'text',
          timestamp: now(),
        });
      }, 400);
    }
  };

  const handleButtonClick = (button: any) => {
    const ts = now();
    addMessage({ text: button.title || button.text, sender: 'user', type: 'text', timestamp: ts } as any);
    const edge = edges.find(e => e.sourceHandle === button.id);
    if (edge?.target) setTimeout(() => executeNode(edge.target), 700);
  };

  // Get all configured keywords
  const allKeywords = nodes
    .filter(n => n.type === 'trigger')
    .flatMap(n => n.data?.keywords || []);

  // Get node path for breadcrumb
  const activeNode = nodes.find(n => n.id === activeNodeId);

  // ── Drag-to-reposition ──────────────────────────────────────────────
  const [pos, setPos] = useState({ x: 0, y: 0 });      // offset from default anchor
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const [minimized, setMinimized] = useState(false);

  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragStart.current) return;
      setPos({
        x: dragStart.current.px + (e.clientX - dragStart.current.mx),
        y: dragStart.current.py + (e.clientY - dragStart.current.my),
      });
    };
    const onUp = () => { setDragging(false); dragStart.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  return (
    <div
      className="fixed z-[9999] flex flex-col"
      style={{
        bottom: `${24 - pos.y}px`,
        right: `${24 - pos.x}px`,
        width:  minimized ? '290px' : '360px',
        transition: dragging ? 'none' : 'width 0.2s ease',
        userSelect: 'none',
      }}
    >
      {/* ── Drag Handle / Title Bar ── */}
      <div
        onMouseDown={onDragStart}
        className={`flex items-center justify-between px-3.5 py-2.5 bg-[#202c33] rounded-t-sm border-b border-white/5 cursor-grab active:cursor-grabbing select-none shadow-2xl ${minimized ? 'rounded-sm' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <div className="flex items-center gap-1.5">
            <button 
              onClick={(e) => { e.stopPropagation(); handleReset(); }}
              className="p-1 text-white/40 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-md transition-all"
              title="Reiniciar"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setMinimized(v => !v); }}
              className="p-1 text-white/40 hover:text-amber-400 hover:bg-amber-400/10 rounded-md transition-all"
              title={minimized ? "Expandir" : "Minimizar"}
            >
              {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="p-1 text-white/40 hover:text-rose-400 hover:bg-rose-400/10 rounded-md transition-all"
              title="Cerrar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="w-6 h-6 rounded-full overflow-hidden shrink-0">
            <img src="https://ui-avatars.com/api/?name=IA&background=00a884&color=fff&bold=true" alt="Bot" className="w-full h-full" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-[11px] font-black leading-none truncate">Simulador</p>
            <p className={`text-[9px] font-bold uppercase tracking-wider leading-none mt-0.5 transition-colors truncate ${
              isTyping ? 'text-[#00a884]' : delayCountdown !== null ? 'text-sky-400' : 'text-white/35'
            }`}>
              {isTyping
                ? 'escribiendo...'
                : delayCountdown !== null
                  ? `esperando ${delayCountdown}s...`
                  : flowStarted
                    ? `▶ ${NODE_LABELS[activeNode?.type || ''] || 'completado'}`
                    : 'en línea'}
            </p>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1" onMouseDown={e => e.stopPropagation()}>
          {/* Mode badge */}
          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${
            matchingStrategy === 'strict'
              ? 'bg-primary-500/20 border-primary-500/30 text-primary-400'
              : 'bg-amber-500/20 border-amber-500/30 text-amber-400'
          }`}>
            {matchingStrategy === 'strict' ? 'estricto' : 'inteligente'}
          </span>
        </div>
      </div>

      {/* ── Phone body (hidden when minimized) ── */}
      {!minimized && (
        <div className="flex flex-col bg-[#111b21] rounded-b-sm shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] overflow-hidden border border-t-0 border-[#202c33]"
          style={{ height: '520px' }}>

          {/* Mode + Keywords bar */}
          <div className="bg-[#182229] border-b border-white/5 px-3 py-1.5 flex items-center gap-2 overflow-x-auto shrink-0 custom-scrollbar">
            {allKeywords.length > 0 ? (
              <>
                <span className="text-[8px] font-black uppercase text-white/25 shrink-0">activar:</span>
                {allKeywords.slice(0, 6).map((kw: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => handleSendText(kw)}
                    className="shrink-0 px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[8px] font-black rounded-full uppercase tracking-wider hover:bg-emerald-500/25 transition-all active:scale-95 whitespace-nowrap"
                  >
                    {kw}
                  </button>
                ))}
              </>
            ) : (
              <span className="text-[8px] text-white/25 font-bold italic">Sin palabras clave configuradas</span>
            )}
          </div>

          {/* Chat Area */}
          <div
            className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1.5 relative custom-scrollbar"
            style={{
              backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
              backgroundBlendMode: 'overlay',
              backgroundSize: '400px',
              backgroundColor: '#0b141a'
            }}
          >
            <div className="self-center px-2.5 py-0.5 bg-[#182229] rounded-sm mb-1 mt-0.5 border border-white/5 z-10 relative">
              <span className="text-[8px] text-white/40 font-bold uppercase tracking-widest">
                {new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>

            <div className="flex flex-col gap-1.5 relative z-10">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} onButtonClick={handleButtonClick} />
              ))}
              {isTyping && (
                <div className="self-start bg-[#202c33] px-3.5 py-2.5 rounded-sm rounded-tl-none shadow-sm flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce" />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Capture / Mode hint strip */}
          {(waitingForCaptureNodeId || !flowStarted) && (
            <div className={`px-3 py-1 shrink-0 border-t ${
              waitingForCaptureNodeId
                ? 'bg-amber-500/10 border-amber-500/20'
                : 'bg-[#182229]/80 border-white/5'
            }`}>
              <p className={`text-[8px] font-black uppercase tracking-wider ${
                waitingForCaptureNodeId ? 'text-amber-400' : 'text-white/25'
              } flex items-center gap-1.5`}>
                {waitingForCaptureNodeId
                  ? <><span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" /> Esperando respuesta...</>
                  : matchingStrategy === 'strict'
                    ? '⚡ Modo estricto: escribe la palabra clave exacta'
                    : '🧠 Modo inteligente: la clave puede estar en la oración'}
              </p>
            </div>
          )}

          {/* Input Bar */}
          <div className="bg-[#0b141a] px-2.5 py-2 flex items-center gap-2 shrink-0">
            <div className="flex-1 flex items-center gap-1.5 bg-[#2a3942] rounded-full px-3 py-1.5 border border-white/5">
              <Smile className="w-4 h-4 text-white/25 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                className="flex-1 bg-transparent border-none outline-none text-[#e9edef] text-[13px] placeholder-white/20 min-w-0"
                placeholder={waitingForCaptureNodeId ? 'Tu respuesta...' : 'Mensaje...'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendText(inputValue); }}
                autoFocus
              />
            </div>
            <button
              onClick={() => handleSendText(inputValue)}
              className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-lg active:scale-90 transition-all hover:brightness-110 shrink-0"
            >
              {inputValue ? <Send className="w-3.5 h-3.5 ml-0.5" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─────────────────── Message Bubble Sub-component ─────────────────── */

const MessageBubble: React.FC<{ msg: Message; onButtonClick: (btn: any) => void }> = ({ msg, onButtonClick }) => {
  const [imgError, setImgError] = useState(false);

  if (msg.sender === 'system') {
    const isDelay   = msg.type === 'delay';
    const isWebhook = msg.type === 'webhook';
    const isHandoff = msg.type === 'handoff';
    const isCapture = msg.type === 'capture' && msg.sender === 'system';

    return (
      <div className={`self-center max-w-[85%] animate-in fade-in slide-in-from-top-2 duration-400 my-1`}>
        <div className={`px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-widest text-center border flex items-center gap-2 justify-center ${
          isDelay || isWebhook || isHandoff || isCapture
            ? 'bg-accent-500/10 border-accent-500/20 text-accent-300'
            : 'bg-[#182229] border-white/10 text-white/50'
        }`}>
          {isDelay   && <Clock className="w-3 h-3 shrink-0" />}
          {isWebhook && <Globe className="w-3 h-3 shrink-0" />}
          {isHandoff && <UserCheck className="w-3 h-3 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      </div>
    );
  }

  const isUser = msg.sender === 'user';

  return (
    <div className={`flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 ${isUser ? 'items-end' : 'items-start'}`}>
      <div className={`relative max-w-[82%] px-3.5 py-2.5 rounded-sm shadow-sm ${
        msg.type === 'error'
          ? 'bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-tl-none'
          : isUser
            ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
            : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
      }`}>

        {/* Tail */}
        <div className={`absolute top-0 w-3 h-3 ${
          isUser
            ? 'right-[-7px] border-l-[10px] border-l-[#005c4b] border-b-[10px] border-b-transparent'
            : msg.type === 'error'
              ? 'left-[-7px] border-r-[10px] border-r-[#380c0c] border-b-[10px] border-b-transparent'
              : 'left-[-7px] border-r-[10px] border-r-[#202c33] border-b-[10px] border-b-transparent'
        }`} />

        {/* Media Preview */}
        {msg.type === 'media' && msg.mediaUrl && (
          <div className="mb-2 rounded-sm overflow-hidden bg-black/30 border border-white/10 max-w-[240px]">
            {!imgError ? (
              <img
                src={msg.mediaUrl}
                alt="Media"
                className="w-full max-h-40 object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="h-24 flex flex-col items-center justify-center gap-2 p-3">
                <Image className="w-8 h-8 text-white/20" />
                <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider text-center break-all">{msg.mediaUrl}</span>
              </div>
            )}
          </div>
        )}

        {/* Capture indicator */}
        {msg.type === 'capture' && msg.variableName && (
          <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-accent-500/15 rounded-sm border border-accent-500/20">
            <span className="text-[9px] font-black uppercase text-accent-300">Guardará en @{msg.variableName}</span>
          </div>
        )}

        {msg.text && (
          <p className="leading-relaxed whitespace-pre-wrap text-[14px] break-words">{msg.text}</p>
        )}

        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-[10px] text-white/35 leading-none">{msg.timestamp}</span>
          {isUser && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
        </div>
      </div>

      {/* Interactive Buttons */}
      {msg.buttons && msg.buttons.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1.5 w-full max-w-[82%]">
          {msg.buttons.map((btn, bIdx) => (
            <button
              key={bIdx}
              onClick={() => onButtonClick(btn)}
              className="bg-[#182229] border border-[#53bdeb]/20 hover:bg-[#2a3942] hover:border-[#53bdeb]/50 text-[#53bdeb] text-[13px] font-bold py-2.5 px-5 rounded-full shadow transition-all active:scale-95 text-center"
            >
              {btn.title || btn.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
