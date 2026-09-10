import { useCallback, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  reconnectEdge,
  BackgroundVariant,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  MarkerType,
} from '@xyflow/react';
import { useMemo } from 'react';
import '@xyflow/react/dist/style.css';

import { TriggerNode } from './TriggerNode';
import { TextNode } from './TextNode';
import CustomEdge from './CustomEdge';
import { InteractiveNode } from './InteractiveNode';
import { ConfirmationNode } from './ConfirmationNode';
import { MediaNode } from './MediaNode';
import { CaptureNode } from './CaptureNode';
import { CapturePhoneNode } from './CapturePhoneNode';
import { WebhookNode } from './WebhookNode';
import { HandoffNode } from './HandoffNode';
import { DelayNode } from './DelayNode';
import { CatalogNode } from './CatalogNode';
import { ConditionNode } from './ConditionNode';
import { LlmNode } from './LlmNode';
import { KnowledgeRetrievalNode } from './KnowledgeRetrievalNode';
import { EmailNode } from './EmailNode';
import { FlowSimulator } from './FlowSimulator';
import { TriggerInput } from './TriggerInput';
import { Dropdown } from '../../../components/ui/Dropdown';
import {
  Save, Bot, Play, Zap, Settings, Layers,
  Trash2, GitBranch, Sparkles, Library, UserCheck,
  ChevronRight, Plus, BadgeInfo, HelpCircle, Edit2, Mail
} from 'lucide-react';
import {
  HiMiniPlus,
  HiMiniSquare3Stack3D,
  HiMiniChatBubbleBottomCenterText,
  HiMiniVideoCamera,
  HiMiniVariable,
  HiMiniClock,
  HiMiniGlobeAlt,
  HiMiniUserPlus,
  HiMiniTrash,
  HiMiniBolt,
  HiMiniStar,
  HiMiniCheckCircle
} from "react-icons/hi2";
import { saveFlows, getActiveConnectionsForFlow } from '../../../services/api';
import { Loader } from '../../../components/ui/Loader';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';

// Textos de ayuda que se muestran en el icono "?" del panel de propiedades.
// Centraliza los tips para que no ocupen espacio dentro del formulario.
const NODE_HELP_TEXTS: Record<string, string> = {
  trigger: 'Inicia el flujo cuando el usuario envía un mensaje que coincide con las palabras clave de activación.',
  text: 'Envía un mensaje de texto simple al usuario. Puedes usar {{nombre}} para personalizar con datos del contacto.',
  interactive: 'Cloud API: botones reales clickeables (máx. 3). QR: opciones numeradas como texto (sin límite).',
  confirmation: 'Pide al usuario confirmar Sí o No. Conecta la salida Sí y No (y la No suele volver al menú). El bot también entiende respuestas de texto libre "sí"/"no".',
  media: 'Envía una imagen, video o documento adjunto al usuario.',
  catalog: 'Envía un producto desde tu catálogo de Meta al usuario.',
  capture: 'Hace una pregunta y guarda la respuesta del usuario en una variable (ej. @nombre).',
  capture_phone: 'Pide al usuario su número de celular. Se valida automáticamente y se guarda en @telefono del contacto.',
  condition: 'Evalúa una condición (ej. variable existe, valor es igual) y bifurca el flujo según el resultado.',
  delay: 'Pausa el flujo temporalmente simulando que el bot está escribiendo o esperando.',
  webhook: 'Envía datos a un sistema externo o API de tu empresa.',
  handoff: 'Detiene el bot y transfiere la conversación a un agente humano.',
  email: 'Compone y envía un correo electrónico. Puedes usar {{variable}} para insertar datos capturados del usuario.',
  llm: 'Genera una respuesta usando un modelo de lenguaje (LLM) con contexto de la conversación.',
  knowledge_retrieval: 'Busca información relevante en una base de conocimiento y la usa como contexto.',
};



interface FlowBuilderContentProps {
  flowData: {
    id: string;
    _id?: string;
    name: string;
    nodes: any[];
    edges: any[];
    triggers: string[];
    category: string;
    status?: string;
    matchingStrategy?: 'strict' | 'flexible';
    reactivationTime?: number;
  };
  onBack?: () => void;
}

export const FlowBuilderContent = ({ flowData, onBack }: FlowBuilderContentProps) => {
  const [nodes, setNodes] = useState(flowData.nodes || []);
  const [edges, setEdges] = useState(flowData.edges || []);

  const onNodesChange = useCallback((changes: any) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: any) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const nodeTypes = useMemo(() => ({
    trigger: TriggerNode,
    text: TextNode,
    interactive: InteractiveNode,
    confirmation: ConfirmationNode,
    media: MediaNode,
    capture: CaptureNode,
  capture_phone: CapturePhoneNode,
    webhook: WebhookNode,
    handoff: HandoffNode,
    delay: DelayNode,
    catalog: CatalogNode,
    condition: ConditionNode,
    llm: LlmNode,
    knowledge_retrieval: KnowledgeRetrievalNode,
    email: EmailNode,
  }), []);

  const edgeTypes = useMemo(() => ({ default: CustomEdge }), []);

  const defaultEdgeOptions = useMemo(() => ({
    type: 'default',
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#94a3b8' },
    style: { stroke: '#64748b', strokeWidth: 2 },
  }), []);

  const [currentTriggers, setCurrentTriggers] = useState(flowData.triggers || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isFlowActive, setIsFlowActive] = useState(flowData.status === 'active');
  const [history, setHistory] = useState([{ nodes: flowData.nodes || [], edges: flowData.edges || [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [activeTab, setActiveTab] = useState<'nodos' | 'propiedades'>('nodos');
  const [matchingStrategy, setMatchingStrategy] = useState<'strict' | 'flexible'>(flowData.matchingStrategy || 'strict');
  const [flowName, setFlowName] = useState(flowData.name || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(flowData.name || '');
  const [flowCategory, setFlowCategory] = useState(flowData.category || 'other');
  const [reactivationTime, setReactivationTime] = useState<number>(flowData.reactivationTime || 30);
  const [activeConnections, setActiveConnections] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    const flowId = flowData.id || flowData._id;
    if (flowId) {
      getActiveConnectionsForFlow(flowId)
        .then(setActiveConnections)
        .catch(err => console.error('Error fetching active connections:', err));
    }
  }, [flowData.id, flowData._id]);

  const incomingEdges = useMemo(() =>
    edges.filter(e => e.target === selectedNodeId && nodes.some(n => n.id === e.source)),
    [edges, nodes, selectedNodeId]
  );

  const outgoingEdges = useMemo(() =>
    edges.filter(e => e.source === selectedNodeId && nodes.some(n => n.id === e.target)),
    [edges, nodes, selectedNodeId]
  );

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setNodes(history[newIndex].nodes);
      setEdges(history[newIndex].edges);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setNodes(history[newIndex].nodes);
      setEdges(history[newIndex].edges);
    }
  }, [history, historyIndex]);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showMiniMap, setShowMiniMap] = useState(true);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
          setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
          setSelectedNodeId(null);
          pushToHistory();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId]);

  const onNodeClick = useCallback((_: any, node: any) => {
    setSelectedNodeId(node.id);
    setActiveTab('propiedades');
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const onNodesDelete = useCallback((deleted: any[]) => {
    const deletedIds = new Set(deleted.map((n) => n.id));
    setEdges((eds) => eds.filter((e) => !deletedIds.has(e.source) && !deletedIds.has(e.target)));
  }, []);

  const updateNodeData = useCallback((newData: any) => {
    if (!selectedNodeId) return;

    setNodes((nds) => nds.map((n) =>
      n.id === selectedNodeId
        ? { ...n, data: { ...n.data, ...newData, _updatedAt: Date.now() }, style: { ...n.style, height: 'auto' } }
        : n
    ));
  }, [selectedNodeId]);

  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    if (isSaving) return;

    const timer = setTimeout(() => {
      const currentData = {
        nodes,
        edges,
        flowName,
        flowCategory,
        currentTriggers,
        matchingStrategy,
        reactivationTime,
        isFlowActive
      };
      const currentDataString = JSON.stringify(currentData);

      if (lastSavedRef.current && lastSavedRef.current !== currentDataString) {
        saveFlow(false);
      }
      lastSavedRef.current = currentDataString;
    }, 5000);

    return () => clearTimeout(timer);
  }, [nodes, edges, flowName, flowCategory, currentTriggers, matchingStrategy, reactivationTime, isFlowActive, isSaving]);

  const pushToHistory = () => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: [...nodes], edges: [...edges] });
    setHistory(newHistory);
    setHistoryIndex(historyIndex + 1);
  };

  const clearCanvas = () => {
    setShowClearConfirm(true);
  };

  const confirmClearCanvas = () => {
    setNodes([]);
    setEdges([]);
    pushToHistory();
    setShowClearConfirm(false);
  };

  const onReconnect = useCallback((oldEdge: any, newConnection: any) => {
    pushToHistory();
    setEdges((els) => reconnectEdge(oldEdge, newConnection, els));
  }, [setEdges]);

  const onReconnectStart = useCallback(() => { }, []);
  const onReconnectEnd = useCallback((_: any, connection: any) => {
    if (!connection.handleId) {
      setEdges((els) => els.filter((e) => e.id !== connection.edgeId));
      pushToHistory();
    }
  }, [setEdges]);

  const onConnect = useCallback((params: any) => {
    pushToHistory();
    setEdges((eds) => addEdge(params, eds));
  }, [nodes, edges]);

  const handleTriggersChange = (triggers: string[]) => {
    setCurrentTriggers(triggers);
    setNodes((nds) => nds.map((n) => n.type === 'trigger' ? { ...n, data: { ...n.data, keywords: triggers } } : n));
  };

  const saveFlow = async (showFeedback = true) => {
    setIsSaving(true);
    try {
      // PERSISTENCE STRATEGY: Store config in the Trigger node's data to avoid DB schema issues
      const updatedNodes = nodes.map(n =>
        n.type === 'trigger'
          ? { ...n, data: { ...n.data, matchingStrategy, reactivationTime, keywords: currentTriggers } }
          : n
      );

      await saveFlows({
        name: flowName,
        nodes: updatedNodes,
        edges,
        triggers: currentTriggers,
        status: isFlowActive ? 'active' : 'draft',
        category: flowCategory,
        // Send these too just in case, but rely on nodes for persistence
        matchingStrategy,
        reactivationTime
      }, flowData.id || flowData._id);

      setNodes(updatedNodes);
      flowData.triggers = currentTriggers;

      if (showFeedback) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save flow:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const onDragOver = useCallback((event: any) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: any) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const defaultData: Record<string, any> = { label: type, text: '' };
    if (type === 'capture_phone') {
      defaultData.question = 'Por favor, ingresa tu número de celular:';
      defaultData.variableName = 'telefono';
      defaultData.validationType = 'phone';
    }
    if (type === 'confirmation') {
      defaultData.bodyText = '¿Confirmas esta acción?';
      defaultData.yesLabel = '✅ Sí';
      defaultData.noLabel = '❌ No';
      defaultData.retryMessage = 'Por favor responde Sí o No para continuar:';
    }
    const newNode = {
      id: `node_${Date.now()}`,
      type,
      position,
      data: defaultData,
    };
    setNodes((nds) => nds.concat(newNode));
    pushToHistory();
  }, [screenToFlowPosition]);

  const insertFormatting = (id: string, type: string, nodeType: string, token?: string) => {
    const textarea = document.getElementById(id) as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    let formattedText = '';

    switch (type) {
      case 'bold': formattedText = `*${selectedText}*`; break;
      case 'italic': formattedText = `_${selectedText}_`; break;
      case 'strike': formattedText = `~${selectedText}~`; break;
      case 'code': formattedText = `\`\`\`${selectedText}\`\`\``; break;
      case 'variable': formattedText = token || '{{variable}}'; break;
      default: formattedText = selectedText;
    }

    const newValue = text.substring(0, start) + formattedText + text.substring(end);

    if (nodeType === 'text') {
      updateNodeData({ text: newValue });
    } else if (nodeType === 'interactive') {
      updateNodeData({ bodyText: newValue });
    } else if (nodeType === 'confirmation') {
      updateNodeData({ bodyText: newValue });
    } else if (nodeType === 'capture') {
      updateNodeData({ question: newValue });
    }
  };

  const chatNodes = [
    { id: 'trigger', label: 'Disparador', sub: 'Palabras Clave', icon: HiMiniBolt, color: 'accent', helpText: 'Inicia el flujo cuando el usuario envía un mensaje que coincide con las palabras clave.' },
    { id: 'text', label: 'Texto', sub: 'Mensaje Simple', icon: HiMiniChatBubbleBottomCenterText, color: 'accent', helpText: 'Envía un mensaje de texto simple al usuario.' },
    { id: 'interactive', label: 'Botones', sub: 'Opciones Rápidas', icon: HiMiniSquare3Stack3D, color: 'accent', helpText: 'Envía un mensaje con botones interactivos para que el usuario elija una opción.' },
    { id: 'confirmation', label: 'Confirmación', sub: 'Sí / No', icon: HiMiniCheckCircle, color: 'accent', helpText: 'Pide al usuario confirmar Sí o No y bifurca el flujo según la respuesta.' },
    { id: 'media', label: 'Media', sub: 'Imagen / Video', icon: HiMiniVideoCamera, color: 'accent', helpText: 'Envía una imagen, video o documento adjunto.' },
    { id: 'catalog', label: 'Catálogo', sub: 'Enviar Producto', icon: HiMiniStar, color: 'accent', helpText: 'Envía un producto desde tu catálogo al usuario.' },
  ];

  const integrationNodes = [
    { id: 'capture', label: 'Captura', sub: 'Pedir Dato', icon: HiMiniVariable, color: 'accent', helpText: 'Hace una pregunta y guarda la respuesta del usuario en una variable (ej. @nombre).' },
    { id: 'capture_phone', label: 'Capturar Celular', sub: 'Pedir Número', icon: HiMiniVariable, color: 'accent', helpText: 'Pide al usuario su número de celular. Se valida y guarda automáticamente en el contacto.' },
    { id: 'condition', label: 'Condición', sub: 'Si / Entonces', icon: GitBranch, color: 'accent', helpText: 'Evalúa una condición (ej. variable existe, valor es igual) y bifurca el flujo según el resultado.' },
    { id: 'delay', label: 'Espera', sub: 'Escribiendo...', icon: HiMiniClock, color: 'accent', helpText: 'Pausa el flujo temporalmente simulando que el bot está escribiendo o esperando.' },
    { id: 'webhook', label: 'Webhook', sub: 'API Externa', icon: HiMiniGlobeAlt, color: 'accent', helpText: 'Envía datos a un sistema externo o API de tu empresa.' },
    { id: 'handoff', label: 'Humano', sub: 'Transferir', icon: HiMiniUserPlus, color: 'accent', helpText: 'Detiene el bot y transfiere la conversación a un agente humano.' },
    { id: 'email', label: 'Correo', sub: 'Enviar Email', icon: Mail, color: 'accent', helpText: 'Compone y envía un correo electrónico directamente desde el flujo a la dirección indicada.' },
  ];

  const aiNodes = [
    { id: 'llm', label: 'IA Completa', sub: 'Chat LLM', icon: HiMiniBolt, color: 'accent', helpText: 'Genera una respuesta usando un modelo de lenguaje (LLM) con contexto de la conversación.' },
    { id: 'knowledge_retrieval', label: 'Base Conocimiento', sub: 'RAG', icon: HiMiniSquare3Stack3D, color: 'accent', helpText: 'Busca información relevante en una base de conocimiento y la usa como contexto.' },
  ];

  const nodeColorStyles: Record<string, { border: string; icon: string }> = {
    accent: { border: 'hover:border-accent-500', icon: 'group-hover:bg-accent-500 group-hover:text-white' },
  };

  const renderNodeButton = (node: any) => {
    const styles = nodeColorStyles[node.color] || { border: 'hover:border-accent-500', icon: 'group-hover:bg-accent-500 group-hover:text-white' };
    return (
      <div key={node.id} className="relative">
        <button
          draggable
          onDragStart={(e) => e.dataTransfer.setData('application/reactflow', node.id)}
          onClick={() => {
            const position = { x: 250, y: 250 };
            const defaultData: Record<string, any> = { label: node.id, text: '' };
            if (node.id === 'capture_phone') {
              defaultData.question = 'Por favor, ingresa tu número de celular:';
              defaultData.variableName = 'telefono';
              defaultData.validationType = 'phone';
            }
            const newNode = {
              id: `node_${Date.now()}`,
              type: node.id,
              position,
              data: defaultData,
            };
            setNodes((nds) => nds.concat(newNode));
            pushToHistory();
          }}
          className={`w-full flex flex-col items-center justify-center p-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl transition-all text-center group ${styles.border}`}
        >
          <div className={`p-3 rounded-2xl mb-3 transition-all shadow-lg relative bg-black dark:bg-slate-800 text-accent-500 ${styles.icon}`}>
            <node.icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-[10px] font-black text-slate-900 dark:text-white mb-1 uppercase tracking-widest">{node.label}</h3>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{node.sub}</p>
          </div>
        </button>

        {/* Ícono de Ayuda y su Tooltip (solo activo al hacer hover en el ícono) */}
        <div className="absolute top-2 right-2 group/help z-50">
          <div className="text-slate-300 dark:text-slate-600 hover:text-accent-500 cursor-help transition-colors p-1">
            <HelpCircle className="w-3.5 h-3.5" />
          </div>

          {/* Tooltip de Información */}
          <div className="absolute right-0 bottom-full mb-1 w-48 p-3 bg-slate-900 dark:bg-slate-800 text-left rounded-xl shadow-xl opacity-0 invisible group-hover/help:opacity-100 group-hover/help:visible transition-all pointer-events-none">
            <h4 className="text-[10px] font-black uppercase text-accent-400 tracking-widest mb-1">{node.label}</h4>
            <p className="text-[9px] font-medium text-slate-300 leading-relaxed">{node.helpText}</p>
            <div className="absolute right-2 top-full border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-slate-50 dark:bg-[#252525] overflow-hidden">
      <style>{`
        .react-flow__handle {
          width: 12px;
          height: 12px;
          border: 2.5px solid white;
          transition: all 0.2s ease;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        .react-flow__handle:hover, .react-flow__handle-connecting {
          width: 16px;
          height: 16px;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.25), 0 2px 8px rgba(0,0,0,0.2);
        }
        .react-flow__handle::after {
          content: "";
          position: absolute;
          top: -8px;
          left: -8px;
          right: -8px;
          bottom: -8px;
        }
        .react-flow__node { cursor: pointer; }
        .react-flow__node.selected .node-container {
          box-shadow: 0 0 0 2px rgba(99,102,241,0.5), 0 8px 32px rgba(0,0,0,0.12) !important;
        }
        .dark .react-flow__node.selected .node-container {
          box-shadow: 0 0 0 2px rgba(99,102,241,0.6), 0 8px 32px rgba(0,0,0,0.3) !important;
        }

        /* ---- Edge / connection polish ---- */
        .react-flow__edge-path {
          transition: stroke 0.2s ease, stroke-width 0.2s ease, filter 0.2s ease;
        }
        .react-flow__edge:hover .react-flow__edge-path,
        .react-flow__edge.selected .react-flow__edge-path {
          stroke-width: 3 !important;
          filter: drop-shadow(0 0 5px rgba(129,140,248,0.5));
        }
        .react-flow__edge-interaction {
          stroke: transparent;
          stroke-width: 14 !important;
        }
        .react-flow__edge-textbg {
          fill: transparent;
        }

        /* Animated flowing dashes over edges on hover/selected */
        .react-flow__edge:hover .flow-edge-path,
        .react-flow__edge.selected .flow-edge-path {
          stroke-dasharray: 8 6;
          animation: flowdash 0.6s linear infinite;
        }
        @keyframes flowdash {
          to { stroke-dashoffset: -14; }
        }

        /* ---- Connection line while dragging ---- */
        .react-flow__connection-path {
          stroke: #818cf8;
          stroke-width: 2.5;
          stroke-dasharray: 6 4;
          animation: flowdash 1s linear infinite;
        }

        /* ---- Background pattern ---- */
        .react-flow__background {
          opacity: 0.7;
          transition: opacity 0.3s ease;
        }
      `}</style>

      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent-500/5 blur-[120px] rounded-full pointer-events-none -mr-32 -mt-32" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent-500/5 blur-[100px] rounded-full pointer-events-none -ml-20 -mb-20" />

      {/* Header - Fixed at Top */}
      <div className="h-16 bg-white dark:bg-dark-card border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-6 z-50 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="group p-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
            >
              <ChevronRight className="w-4 h-4 rotate-180 text-slate-600 dark:text-slate-300 transition-colors" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-accent-500 to-accent-700 rounded-xl shadow-md">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 group/edit-name">
                {isEditingName ? (
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={() => {
                      setIsEditingName(false);
                      if (tempName.trim()) {
                        setFlowName(tempName);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setIsEditingName(false);
                        if (tempName.trim()) {
                          setFlowName(tempName);
                        }
                      } else if (e.key === 'Escape') {
                        setIsEditingName(false);
                        setTempName(flowName);
                      }
                    }}
                    className="bg-slate-50 dark:bg-slate-800 text-sm font-black text-slate-900 dark:text-white px-2 py-0.5 rounded-lg border-2 border-accent-500 focus:outline-none max-w-[200px]"
                    autoFocus
                  />
                ) : (
                  <div
                    onClick={() => {
                      setTempName(flowName);
                      setIsEditingName(true);
                    }}
                    className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 px-2 py-0.5 rounded-lg transition-all"
                  >
                    <h1 className="text-sm font-black text-slate-900 dark:text-white tracking-tight truncate max-w-[200px] md:max-w-[300px]" title={flowName}>
                      {flowName || 'Sin Nombre'}
                    </h1>
                    <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover/edit-name:opacity-100 transition-opacity" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 px-2">
                <span className={`text-[8px] font-black uppercase tracking-widest ${isFlowActive ? 'text-accent-500' : 'text-slate-400'}`}>
                  {isFlowActive ? 'En Línea' : 'Borrador'}
                </span>
                {activeConnections.length > 0 && (
                  <>
                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                    <div className="flex items-center -space-x-1">
                      {activeConnections.slice(0, 3).map((conn) => (
                        <div
                          key={conn.id}
                          className="w-4 h-4 rounded-full bg-accent-500 border border-white dark:border-dark-card flex items-center justify-center text-[7px] font-black text-white cursor-help"
                          title={`Bot: ${conn.display_name} (${conn.phone_number})`}
                        >
                          {conn.display_name?.charAt(0).toUpperCase() || 'B'}
                        </div>
                      ))}
                    </div>
                    <span className="text-[8px] font-bold text-accent-500 uppercase tracking-tighter">
                      {activeConnections.length} Activo{activeConnections.length > 1 ? 's' : ''}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-100 dark:bg-slate-800 mx-1 hidden md:block" />

          {/* Activity Toggle */}
          <button
            onClick={() => setIsFlowActive(!isFlowActive)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border ${isFlowActive
              ? 'bg-accent-50 border-accent-100 dark:bg-accent-500/10 dark:border-accent-500/20'
              : 'bg-slate-50 border-slate-100 dark:bg-slate-800/40 dark:border-slate-700'
              }`}
          >
            <div className={`w-6 h-3 rounded-full relative transition-all duration-300 ${isFlowActive ? 'bg-accent-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all duration-300 ${isFlowActive ? 'left-[14px]' : 'left-0.5'}`} />
            </div>
            <span className={`text-[8px] font-black uppercase tracking-[0.1em] ${isFlowActive ? 'text-accent-700 dark:text-accent-400' : 'text-slate-500'}`}>
              {isFlowActive ? 'Activo' : 'Borrador'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSimulator(true)}
            className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 text-accent-500" />
            <span>Simular</span>
          </button>

          <button
            onClick={() => saveFlow()}
            disabled={isSaving}
            className={`px-6 py-2 rounded-xl font-black uppercase tracking-widest text-[9px] shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 ${saveSuccess
              ? 'bg-accent-500 text-white animate-pulse'
              : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
              }`}
          >
            {isSaving ? (
              <Loader size="xs" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{saveSuccess ? '¡Guardado!' : 'Guardar'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onReconnectStart={onReconnectStart}
            onReconnectEnd={onReconnectEnd}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            connectionLineStyle={{ stroke: '#818cf8', strokeWidth: 2.5, strokeDasharray: '6 4' }}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodesDelete={onNodesDelete}
            snapToGrid={snapToGrid}
            snapGrid={[20, 20]}
            fitView
            deleteKeyCode={null}
          >
            <Background color="#94a3b8" variant={BackgroundVariant.Dots} gap={20} size={1} />
            {showMiniMap && (
              <MiniMap
                nodeColor={(node) => {
                  const colorMap: Record<string, string> = {
                    trigger: '#10b981',
                    text: '#3b82f6',
                    interactive: '#8b5cf6',
                    confirmation: '#10b981',
                    media: '#f43f5e',
                    catalog: '#f59e0b',
                    capture: '#06b6d4',
                    capture_phone: '#10b981',
                    condition: '#f59e0b',
                    delay: '#64748b',
                    webhook: '#f97316',
                    handoff: '#ef4444',
                    llm: '#7c3aed',
                    knowledge_retrieval: '#14b8a6',
                  };
                  return colorMap[node.type || ''] || '#6366f1';
                }}
                nodeStrokeColor={(node) => {
                  const strokeMap: Record<string, string> = {
                    trigger: '#059669',
                    text: '#2563eb',
                    interactive: '#7c3aed',
                    confirmation: '#059669',
                    media: '#e11d48',
                    catalog: '#d97706',
                    capture: '#0891b2',
                    capture_phone: '#059669',
                    condition: '#d97706',
                    delay: '#475569',
                    webhook: '#ea580c',
                    handoff: '#dc2626',
                    llm: '#6d28d9',
                    knowledge_retrieval: '#0d9488',
                  };
                  return strokeMap[node.type || ''] || '#4f46e5';
                }}
                nodeStrokeWidth={2}
                nodeBorderRadius={8}
                maskColor="rgba(15,23,42,0.6)"
                pannable
                zoomable
                className="!absolute !bottom-24 !right-4 !w-60 !h-44 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/80 rounded-2xl shadow-2xl overflow-hidden z-40"
                style={{ position: 'absolute' as const, bottom: 96, right: 16 }}
              />
            )}
          </ReactFlow>

          {/* Canvas Toolbar */}
          <div className="absolute left-4 bottom-4 flex flex-col gap-1 z-50 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-1">
            <button
              onClick={() => zoomIn()}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-all"
              title="Acercar"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>
            <button
              onClick={() => zoomOut()}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-all"
              title="Alejar"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>
            <button
              onClick={() => fitView()}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-all"
              title="Ajustar al canvas"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </button>
            <div className="w-full h-px bg-slate-200 dark:bg-slate-800 my-0.5" />
            <button
              onClick={() => setSnapToGrid(!snapToGrid)}
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${snapToGrid ? 'bg-accent-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400'}`}
              title={snapToGrid ? 'Snap: On' : 'Snap: Off'}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <line x1="15" y1="3" x2="15" y2="21" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
              </svg>
            </button>
            <button
              onClick={() => setShowMiniMap(!showMiniMap)}
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${showMiniMap ? 'bg-accent-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400'}`}
              title={showMiniMap ? 'MiniMap: On' : 'MiniMap: Off'}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <rect x="7" y="7" width="4" height="4" rx="1" />
                <rect x="13" y="7" width="4" height="4" rx="1" />
                <rect x="7" y="13" width="4" height="4" rx="1" />
                <rect x="13" y="13" width="4" height="4" rx="1" />
              </svg>
            </button>
          </div>

          {/* Toggle Sidebar Button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-16 bg-white dark:bg-dark-card border-y border-l border-slate-200 dark:border-slate-800 flex items-center justify-center rounded-l-xl shadow-md z-50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isSidebarOpen ? '' : 'rotate-180'}`} />
          </button>
        </div>

        {/* Right Toolbar */}
        <div className={`bg-white dark:bg-dark-card border-l border-slate-200 dark:border-slate-800 flex flex-col z-10 shadow-2xl shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${isSidebarOpen ? 'w-96' : 'w-0 border-l-0'}`}>
          <div className="w-96 flex flex-col h-full">
            <div className="p-1.5 flex gap-1 bg-slate-100/80 dark:bg-slate-800/80 mx-5 mt-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
              <button
                onClick={() => setActiveTab('nodos')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'nodos' ? 'bg-white dark:bg-dark-card text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                <Layers className={`w-3.5 h-3.5 ${activeTab === 'nodos' ? 'text-accent-500' : ''}`} /> Nodos
              </button>
              <button
                onClick={() => setActiveTab('propiedades')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'propiedades' ? 'bg-white dark:bg-dark-card text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                <Settings className={`w-3.5 h-3.5 ${activeTab === 'propiedades' ? 'text-accent-500' : ''}`} /> Propiedades
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar">
              {activeTab === 'nodos' && (
                <div className="space-y-8 mt-6">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">Disparadores</label>
                    <div className="grid grid-cols-2 gap-3">{chatNodes.map(renderNodeButton)}</div>
                  </div>
                  <div className="space-y-4 pt-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">Integraciones</label>
                    <div className="grid grid-cols-2 gap-3">{integrationNodes.map(renderNodeButton)}</div>
                  </div>
                  <div className="space-y-4 pt-4">
                    <label className="text-[10px] font-black text-accent-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Sparkles className="w-3 h-3" /> IA
                    </label>
                    <div className="grid grid-cols-2 gap-3">{aiNodes.map(renderNodeButton)}</div>
                  </div>
                </div>
              )}

              {activeTab === 'propiedades' && !selectedNode && (
                <div className="space-y-8 text-slate-900 dark:text-white">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Nombre</label>
                    <input value={flowName} onChange={(e) => setFlowName(e.target.value)} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-sm text-sm font-bold outline-none border border-transparent focus:border-accent-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Categoría</label>
                    <Dropdown
                      value={flowCategory}
                      onChange={(v) => setFlowCategory(v)}
                      options={[
                        { value: 'sales', label: 'Ventas' },
                        { value: 'support', label: 'Soporte' },
                        { value: 'marketing', label: 'Marketing' },
                        { value: 'onboarding', label: 'Onboarding' },
                        { value: 'other', label: 'Otro' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      Modo del Bot <BadgeInfo className="w-3 h-3" />
                    </label>
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        {
                          id: 'strict',
                          label: 'Modo Estricto',
                          sub: 'Ideal para tus números personales. El bot solo se activa si el mensaje es idéntico a la(s) palabra(s) clave(s) .',
                          color: 'primary'
                        },
                        {
                          id: 'flexible',
                          label: 'Modo Inteligente',
                          sub: 'El bot detecta palabras clave dentro de oraciones largas. Más sensible y proactivo.',
                          color: 'amber'
                        }
                      ].map(opt => (
                        <button key={opt.id} onClick={() => setMatchingStrategy(opt.id as any)} className={`p-5 rounded-xl border-2 text-left transition-all ${matchingStrategy === opt.id ? `border-${opt.color}-500 bg-${opt.color}-50 dark:bg-${opt.color}-900/10` : 'border-slate-100 dark:border-slate-800 hover:border-slate-200'}`}>
                          <h5 className={`text-[11px] font-black uppercase ${matchingStrategy === opt.id ? `text-${opt.color}-600` : 'text-slate-500'}`}>{opt.label}</h5>
                          <p className="text-[10px] font-bold text-slate-400 mt-1 leading-relaxed">{opt.sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Recarga: {reactivationTime}m</label>
                    </div>
                    <input type="range" min="1" max="120" value={reactivationTime} onChange={(e) => setReactivationTime(parseInt(e.target.value))} className="w-full accent-accent-600" />
                  </div>

                  <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-4">Zona de Peligro</h4>
                    <button
                      onClick={clearCanvas}
                      className="w-full py-4 bg-rose-50/50 dark:bg-rose-500/5 text-rose-600 dark:text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 dark:hover:bg-rose-500/10 transition-all flex items-center justify-center gap-2 border border-rose-100 dark:border-rose-500/10 group"
                    >
                      <HiMiniTrash className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      Limpiar Lienzo Completo
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'propiedades' && selectedNode && (
                <div className="space-y-8 text-slate-900 dark:text-white pb-20">
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 -mx-6 px-6 py-4 border-y border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-accent-50 dark:bg-accent-900/20 rounded-xl">
                        {selectedNode.type === 'catalog' && <HiMiniStar className="w-4 h-4 text-accent-600" />}
                        {selectedNode.type === 'trigger' && <Zap className="w-4 h-4 text-accent-600" />}
                        {selectedNode.type === 'text' && <HiMiniChatBubbleBottomCenterText className="w-4 h-4 text-accent-600" />}
                        {selectedNode.type === 'interactive' && <HiMiniSquare3Stack3D className="w-4 h-4 text-accent-600" />}
                        {selectedNode.type === 'confirmation' && <HiMiniCheckCircle className="w-4 h-4 text-accent-600" />}
                        {selectedNode.type === 'media' && <HiMiniVideoCamera className="w-4 h-4 text-accent-600" />}
                        {selectedNode.type === 'capture' && <HiMiniVariable className="w-4 h-4 text-accent-600" />}
                        {selectedNode.type === 'delay' && <HiMiniClock className="w-4 h-4 text-accent-600" />}
                        {selectedNode.type === 'webhook' && <HiMiniGlobeAlt className="w-4 h-4 text-accent-600" />}
                        {selectedNode.type === 'handoff' && <HiMiniUserPlus className="w-4 h-4 text-accent-600" />}
                        {selectedNode.type === 'condition' && <GitBranch className="w-4 h-4 text-accent-600" />}
                        {selectedNode.type === 'llm' && <Sparkles className="w-4 h-4 text-accent-600" />}
                        {selectedNode.type === 'knowledge_retrieval' && <Library className="w-4 h-4 text-accent-600" />}
                        {selectedNode.type === 'email' && <Mail className="w-4 h-4 text-accent-600" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-widest">{selectedNode.type}</h4>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Configuración del Nodo</p>
                        </div>
                        <div className="group/help relative">
                          <div className="text-slate-300 dark:text-slate-600 hover:text-accent-500 cursor-help transition-colors p-0.5">
                            <HelpCircle className="w-3.5 h-3.5" />
                          </div>
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-60 p-3 bg-slate-900 dark:bg-slate-800 text-left rounded-xl shadow-xl opacity-0 invisible group-hover/help:opacity-100 group-hover/help:visible transition-all pointer-events-none z-50">
                            <h5 className="text-[10px] font-black uppercase text-accent-400 tracking-widest mb-1">{selectedNode.type}</h5>
                            <p className="text-[9px] font-medium text-slate-300 leading-relaxed">{NODE_HELP_TEXTS[selectedNode.type] || 'Configura el comportamiento de este nodo según tus necesidades.'}</p>
                            <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveFlow()} className="p-2.5 bg-accent-500 text-white rounded-xl shadow-lg shadow-accent-500/20 hover:scale-105 transition-all"><Save className="w-4 h-4" /></button>
                      <button onClick={() => {
                        const idToRemove = selectedNodeId;
                        setNodes((nds) => nds.filter((n) => n.id !== idToRemove));
                        setEdges((eds) => eds.filter((e) => e.source !== idToRemove && e.target !== idToRemove));
                        setSelectedNodeId(null);
                        pushToHistory();
                      }} className="p-2.5 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <div className="bg-accent-50 dark:bg-accent-500/5 px-3 py-2 rounded-lg border border-accent-100 dark:border-accent-500/10 mb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <HiMiniStar className={`w-3.5 h-3.5 shrink-0 ${selectedNode.data.isConversionNode ? 'text-accent-500 fill-accent-500' : 'text-slate-400'}`} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Cliente Potencial</span>
                        <div className="group/help relative shrink-0">
                          <div className="text-slate-300 dark:text-slate-600 hover:text-accent-500 cursor-help transition-colors p-0.5">
                            <HelpCircle className="w-3 h-3" />
                          </div>
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-52 p-3 bg-slate-900 dark:bg-slate-800 text-left rounded-xl shadow-xl opacity-0 invisible group-hover/help:opacity-100 group-hover/help:visible transition-all pointer-events-none z-50">
                            <h5 className="text-[10px] font-black uppercase text-accent-400 tracking-widest mb-1">Cliente Potencial</h5>
                            <p className="text-[9px] font-medium text-slate-300 leading-relaxed">Si el cliente llega a este nodo, se marca automáticamente como cliente potencial al activarlo.</p>
                            <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => updateNodeData({ isConversionNode: !selectedNode.data.isConversionNode })}
                        className={`w-8 h-4 rounded-full relative transition-all duration-300 shrink-0 ${selectedNode.data.isConversionNode ? 'bg-accent-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow ${selectedNode.data.isConversionNode ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                    </div>
                    {selectedNode.data.isConversionNode && (
                      <p className="mt-1 pl-11 text-[9px] font-bold text-accent-600 uppercase leading-tight animate-in fade-in slide-in-from-top-1">
                        Si el usuario llega a este nodo, será marcado como cliente potencial.
                      </p>
                    )}
                  </div>


                  {selectedNode.type === 'trigger' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div className="bg-accent-50 dark:bg-accent-500/5 p-5 rounded-sm border border-accent-100 dark:border-accent-500/10">
                        <label className="text-[10px] font-black uppercase text-accent-600 tracking-widest mb-4 block">Palabras Clave de Activación</label>
                        <TriggerInput triggers={currentTriggers} onChange={handleTriggersChange} />
                        <p className="mt-3 text-[9px] font-bold text-accent-600/60 leading-relaxed uppercase">El bot responderá automáticamente cuando el usuario escriba estas palabras.</p>
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'text' && (
                    <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Mensaje de Respuesta</label>
                            <div className="group/help relative">
                              <div className="text-slate-300 dark:text-slate-600 hover:text-accent-500 cursor-help transition-colors p-0.5">
                                <HelpCircle className="w-3 h-3" />
                              </div>
                              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-56 p-3 bg-slate-900 dark:bg-slate-800 text-left rounded-xl shadow-xl opacity-0 invisible group-hover/help:opacity-100 group-hover/help:visible transition-all pointer-events-none z-50">
                                <h5 className="text-[10px] font-black uppercase text-accent-400 tracking-widest mb-1">Variables</h5>
                                <p className="text-[9px] font-medium text-slate-300 leading-relaxed">Usa {'{{nombre}}'}, {'{{telefono}}'} o cualquier variable capturada con un nodo Captura. El bot las reemplaza automáticamente con los datos del contacto.</p>
                                <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
                              </div>
                            </div>
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 tabular-nums">{(selectedNode.data.text || '').length} caracteres</span>
                        </div>

                        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden focus-within:border-accent-500 transition-all bg-white dark:bg-slate-800/60 shadow-sm">
                          <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-900/40">
                            <button onClick={() => insertFormatting('node-text', 'bold', 'text')} title="Negrita" className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-black hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all">B</button>
                            <button onClick={() => insertFormatting('node-text', 'italic', 'text')} title="Cursiva" className="w-7 h-7 flex items-center justify-center rounded-lg text-sm italic hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all">I</button>
                            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1.5" />
                            <button
                              onClick={() => insertFormatting('node-text', 'variable', 'text', '{{nombre}}')}
                              title="Insertar variable {{nombre}}"
                              className="px-2 h-6 rounded-md text-[9px] font-black font-mono tracking-wide bg-accent-500/10 text-accent-600 dark:text-accent-400 hover:bg-accent-500/20 transition-all"
                            >{'{{nombre}}'}</button>
                            <button
                              onClick={() => insertFormatting('node-text', 'variable', 'text', '{{telefono}}')}
                              title="Insertar variable {{telefono}}"
                              className="px-2 h-6 rounded-md text-[9px] font-black font-mono tracking-wide bg-accent-500/10 text-accent-600 dark:text-accent-400 hover:bg-accent-500/20 transition-all"
                            >{'{{telefono}}'}</button>
                            <div className="flex-1" />
                          </div>
                          <textarea
                            id="node-text"
                            value={selectedNode.data.text || ''}
                            onChange={(e) => updateNodeData({ text: e.target.value })}
                            placeholder="Escribe el mensaje que enviará el bot..."
                            className="w-full p-6 bg-transparent text-sm font-medium resize-none outline-none min-h-[320px] leading-relaxed"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'interactive' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cuerpo del Mensaje</label>
                            <div className="group/help relative">
                              <div className="text-slate-300 dark:text-slate-600 hover:text-accent-500 cursor-help transition-colors p-0.5">
                                <HelpCircle className="w-3 h-3" />
                              </div>
                              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-56 p-3 bg-slate-900 dark:bg-slate-800 text-left rounded-xl shadow-xl opacity-0 invisible group-hover/help:opacity-100 group-hover/help:visible transition-all pointer-events-none z-50">
                                <h5 className="text-[10px] font-black uppercase text-accent-400 tracking-widest mb-1">Variables</h5>
                                <p className="text-[9px] font-medium text-slate-300 leading-relaxed">Usa {'{{nombre}}'}, {'{{telefono}}'} o cualquier variable capturada con un nodo Captura. El bot las reemplaza automáticamente con los datos del contacto.</p>
                                <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
                              </div>
                            </div>
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 tabular-nums">{(selectedNode.data.bodyText || '').length} caracteres</span>
                        </div>

                        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden focus-within:border-accent-500 transition-all bg-white dark:bg-slate-800/60 shadow-sm">
                          <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-900/40">
                            <button onClick={() => insertFormatting('node-interactive', 'bold', 'text')} title="Negrita" className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-black hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all">B</button>
                            <button onClick={() => insertFormatting('node-interactive', 'italic', 'text')} title="Cursiva" className="w-7 h-7 flex items-center justify-center rounded-lg text-sm italic hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all">I</button>
                            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1.5" />
                            <button
                              onClick={() => insertFormatting('node-interactive', 'variable', 'text', '{{nombre}}')}
                              title="Insertar variable {{nombre}}"
                              className="px-2 h-6 rounded-md text-[9px] font-black font-mono tracking-wide bg-accent-500/10 text-accent-600 dark:text-accent-400 hover:bg-accent-500/20 transition-all"
                            >{'{{nombre}}'}</button>
                            <button
                              onClick={() => insertFormatting('node-interactive', 'variable', 'text', '{{telefono}}')}
                              title="Insertar variable {{telefono}}"
                              className="px-2 h-6 rounded-md text-[9px] font-black font-mono tracking-wide bg-accent-500/10 text-accent-600 dark:text-accent-400 hover:bg-accent-500/20 transition-all"
                            >{'{{telefono}}'}</button>
                            <div className="flex-1" />
                          </div>
                          <textarea
                            id="node-interactive"
                            value={selectedNode.data.bodyText || ''}
                            onChange={(e) => updateNodeData({ bodyText: e.target.value })}
                            placeholder="Escribe el mensaje que acompaña las opciones de respuesta..."
                            className="w-full p-5 bg-transparent text-sm font-medium resize-none outline-none min-h-[140px] leading-relaxed"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block flex justify-between items-center">
                          Botones de Respuesta
                          <span className="text-accent-500">{(selectedNode.data.buttons || []).length}/10</span>
                        </label>
                        <div className="space-y-3">
                          {selectedNode.data.buttons?.map((btn: any, idx: number) => (
                            <div key={btn.id || `sidebar-btn-${idx}`} className="group/btn relative flex items-center gap-2 p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-accent-500 rounded-sm transition-all shadow-sm">
                              <div className="flex-1 relative">
                                <input
                                  value={btn.text || ''}
                                  onChange={(e) => {
                                    const newBtns = (selectedNode.data.buttons || []).map((b: any, bIdx: number) => {
                                      if (bIdx === idx) return { ...b, text: e.target.value };
                                      return b;
                                    });
                                    updateNodeData({ buttons: newBtns });
                                  }}
                                  placeholder={`Opción ${idx + 1}`}
                                  className="w-full px-4 py-2.5 bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none"
                                />
                              </div>
                              <button
                                onClick={() => {
                                  const newBtns = selectedNode.data.buttons.filter((_: any, i: number) => i !== idx);
                                  updateNodeData({ buttons: newBtns });
                                }}
                                className="p-2.5 text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-sm transition-all shrink-0"
                                title="Eliminar botón"
                              >
                                <HiMiniTrash className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          {(selectedNode.data.buttons || []).length < 10 && (
                            <button
                              onClick={() => updateNodeData({ buttons: [...(selectedNode.data.buttons || []), { id: `btn_${Date.now()}`, text: 'Nuevo Botón' }] })}
                              className="w-full py-4 mt-2 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-sm text-[10px] font-black uppercase text-slate-400 hover:border-primary-400 hover:text-accent-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                            >
                              <Plus className="w-4 h-4" /> Añadir Opción
                            </button>
)}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'confirmation' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pregunta</label>
                            <div className="group/help relative">
                              <div className="text-slate-300 dark:text-slate-600 hover:text-accent-500 cursor-help transition-colors p-0.5">
                                <HelpCircle className="w-3 h-3" />
                              </div>
                              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-56 p-3 bg-slate-900 dark:bg-slate-800 text-left rounded-xl shadow-xl opacity-0 invisible group-hover/help:opacity-100 group-hover/help:visible transition-all pointer-events-none z-50">
                                <h5 className="text-[10px] font-black uppercase text-accent-400 tracking-widest mb-1">Variables</h5>
                                <p className="text-[9px] font-medium text-slate-300 leading-relaxed">Usa {'{{nombre}}'}, {'{{telefono}}'} o cualquier variable capturada con un nodo Captura.</p>
                                <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
                              </div>
                            </div>
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 tabular-nums">{(selectedNode.data.bodyText || selectedNode.data.question || '').length} caracteres</span>
                        </div>

                        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden focus-within:border-accent-500 transition-all bg-white dark:bg-slate-800/60 shadow-sm">
                          <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-900/40">
                            <button onClick={() => insertFormatting('node-confirmation', 'bold', 'confirmation')} title="Negrita" className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-black hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all">B</button>
                            <button onClick={() => insertFormatting('node-confirmation', 'italic', 'confirmation')} title="Cursiva" className="w-7 h-7 flex items-center justify-center rounded-lg text-sm italic hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all">I</button>
                            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1.5" />
                            <button
                              onClick={() => insertFormatting('node-confirmation', 'variable', 'confirmation', '{{nombre}}')}
                              title="Insertar variable {{nombre}}"
                              className="px-2 h-6 rounded-md text-[9px] font-black font-mono tracking-wide bg-accent-500/10 text-accent-600 dark:text-accent-400 hover:bg-accent-500/20 transition-all"
                            >{'{{nombre}}'}</button>
                            <button
                              onClick={() => insertFormatting('node-confirmation', 'variable', 'confirmation', '{{telefono}}')}
                              title="Insertar variable {{telefono}}"
                              className="px-2 h-6 rounded-md text-[9px] font-black font-mono tracking-wide bg-accent-500/10 text-accent-600 dark:text-accent-400 hover:bg-accent-500/20 transition-all"
                            >{'{{telefono}}'}</button>
                            <div className="flex-1" />
                          </div>
                          <textarea
                            id="node-confirmation"
                            value={selectedNode.data.bodyText || selectedNode.data.question || ''}
                            onChange={(e) => updateNodeData({ bodyText: e.target.value })}
                            placeholder="¿Confirmas esta acción?"
                            className="w-full p-5 bg-transparent text-sm font-medium resize-none outline-none min-h-[100px] leading-relaxed"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Etiqueta Sí (✓)</label>
                          <input
                            type="text"
                            value={selectedNode.data.yesLabel || '✅ Sí'}
                            onChange={(e) => updateNodeData({ yesLabel: e.target.value })}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border-2 border-emerald-200 dark:border-emerald-800/50 text-xs font-bold text-emerald-700 dark:text-emerald-300 outline-none focus:border-emerald-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Etiqueta No (✕)</label>
                          <input
                            type="text"
                            value={selectedNode.data.noLabel || '❌ No'}
                            onChange={(e) => updateNodeData({ noLabel: e.target.value })}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border-2 border-rose-200 dark:border-rose-800/50 text-xs font-bold text-rose-600 dark:text-rose-300 outline-none focus:border-rose-500 transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Mensaje si responde algo incorrecto</label>
                        <input
                          type="text"
                          value={selectedNode.data.retryMessage || 'Por favor responde Sí o No para continuar:'}
                          onChange={(e) => updateNodeData({ retryMessage: e.target.value })}
                          className="w-full px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-accent-500 transition-all"
                        />
                      </div>

                      <div className="p-4 bg-accent-50 dark:bg-accent-500/5 rounded-xl border border-accent-100 dark:border-accent-500/10">
                        <h5 className="text-[10px] font-black uppercase text-accent-600 dark:text-accent-400 tracking-widest mb-1.5">Cómo conectar</h5>
                        <p className="text-[9px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                          Arrastra desde la salida <span className="text-emerald-600 dark:text-emerald-400 font-black">Sí</span> para continuar el flujo y desde la salida <span className="text-rose-600 dark:text-rose-400 font-black">No</span> para repetir o volver al menú. El bot también entenderá "sí"/"no" escritos como texto.
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'media' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">URL del Archivo</label>
                        <input
                          type="text"
                          value={selectedNode.data.mediaUrl || ''}
                          onChange={(e) => updateNodeData({ mediaUrl: e.target.value })}
                          placeholder="https://ejemplo.com/imagen.jpg"
                          className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-xs font-bold outline-none border-2 border-transparent focus:border-accent-500 transition-all font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Pie de Foto (Opcional)</label>
                        <input
                          type="text"
                          value={selectedNode.data.caption || ''}
                          onChange={(e) => updateNodeData({ caption: e.target.value })}
                          className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-xs font-bold outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'catalog' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Catálogo</label>
                        <Dropdown
                          value={selectedNode.data.catalogId || ''}
                          onChange={(v) => updateNodeData({ catalogId: v })}
                          options={[
                            { value: 'mock-cat-1', label: 'Productos Destacados' },
                            { value: 'mock-cat-2', label: 'Servicios Digitales' },
                            { value: 'mock-cat-3', label: 'Ofertas Especiales' },
                          ]}
                          placeholder="Seleccionar catálogo..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Producto</label>
                        <Dropdown
                          value={selectedNode.data.productId || ''}
                          onChange={(v) => {
                            const catalogId = selectedNode.data.catalogId || '';
                            const catalogMap: Record<string, any[]> = {
                              'mock-cat-1': [
                                { id: 'mock-item-1', title: 'Camiseta Premium', price: '29.99', description: 'Camiseta de algodón orgánico', media_url: 'https://picsum.photos/seed/shirt/400/400' },
                                { id: 'mock-item-2', title: 'Taza Personalizada', price: '14.99', description: 'Taza de cerámica con diseño exclusivo', media_url: 'https://picsum.photos/seed/mug/400/400' },
                                { id: 'mock-item-3', title: 'Gorra Deportiva', price: '19.99', description: 'Gorra ajustable transpirable', media_url: 'https://picsum.photos/seed/cap/400/400' },
                              ],
                              'mock-cat-2': [
                                { id: 'mock-item-4', title: 'Plan Básico', price: '9.99', description: 'Acceso a contenido básico por 1 mes', media_url: 'https://picsum.photos/seed/basic/400/400' },
                                { id: 'mock-item-5', title: 'Plan Premium', price: '29.99', description: 'Acceso ilimitado + soporte prioritario', media_url: 'https://picsum.photos/seed/premium/400/400' },
                              ],
                              'mock-cat-3': [
                                { id: 'mock-item-6', title: 'Pack Bienvenida', price: '49.99', description: 'Kit completo de bienvenida con 3 productos', media_url: 'https://picsum.photos/seed/welcome/400/400' },
                              ],
                            };
                            const products = catalogMap[catalogId] || [];
                            const product = products.find((p: any) => p.id === v);
                            updateNodeData({
                              productId: v,
                              selectedProduct: product || null,
                              catalogName: catalogId ? ({ 'mock-cat-1': 'Productos Destacados', 'mock-cat-2': 'Servicios Digitales', 'mock-cat-3': 'Ofertas Especiales' } as Record<string, string>)[catalogId as string] : '',
                            });
                          }}
                          options={(() => {
                            const catalogId = selectedNode.data.catalogId || '';
                            const catalogMap: Record<string, any[]> = {
                              'mock-cat-1': [
                                { value: 'mock-item-1', label: 'Camiseta Premium' },
                                { value: 'mock-item-2', label: 'Taza Personalizada' },
                                { value: 'mock-item-3', label: 'Gorra Deportiva' },
                              ],
                              'mock-cat-2': [
                                { value: 'mock-item-4', label: 'Plan Básico' },
                                { value: 'mock-item-5', label: 'Plan Premium' },
                              ],
                              'mock-cat-3': [
                                { value: 'mock-item-6', label: 'Pack Bienvenida' },
                              ],
                            };
                            return catalogMap[catalogId] || [];
                          })()}
                          placeholder="Primero selecciona un catálogo..."
                        />
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'capture' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Pregunta al Usuario</label>
                        <textarea
                          value={selectedNode.data.question || ''}
                          onChange={(e) => updateNodeData({ question: e.target.value })}
                          className="w-full p-5 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-sm outline-none border-2 border-transparent focus:border-accent-500 transition-all min-h-[120px]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Variable de Guardado</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-500 font-black">@</span>
                          <input
                            type="text"
                            value={selectedNode.data.variableName || ''}
                            onChange={(e) => updateNodeData({ variableName: e.target.value })}
                            placeholder="nombre_usuario"
                            className="w-full pl-8 pr-5 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-xs font-bold outline-none"
                          />
                        </div>
                        {['telefono', 'phone', 'celular'].some((kw) =>
                          (selectedNode.data.variableName || '').toLowerCase().includes(kw)
                        ) && (
                          <p className="mt-2 text-[9px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wide">
                            Se guardará como el número de teléfono del contacto.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'capture_phone' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Mensaje al Usuario</label>
                        <textarea
                          value={selectedNode.data.question || ''}
                          onChange={(e) => updateNodeData({ question: e.target.value })}
                          placeholder="Por favor, ingresa tu número de celular:"
                          className="w-full p-5 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-sm outline-none border-2 border-transparent focus:border-accent-500 transition-all min-h-[120px]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Variable de Guardado</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-500 font-black">@</span>
                          <input
                            type="text"
                            value="telefono"
                            disabled
                            className="w-full pl-8 pr-5 py-4 bg-slate-100 dark:bg-slate-800 rounded-sm text-xs font-bold outline-none text-slate-400 cursor-not-allowed"
                          />
                        </div>
                        <p className="mt-2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                          Se guarda automáticamente como el número de teléfono del contacto.
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'delay' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tiempo de Espera</label>
                          <span className="text-xl font-black text-accent-600">
                            {selectedNode.data.delaySeconds >= 60
                              ? `${(selectedNode.data.delaySeconds / 60).toFixed(1)}m`
                              : `${selectedNode.data.delaySeconds || 3}s`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="1800"
                          step={selectedNode.data.delaySeconds >= 60 ? 30 : 1}
                          value={selectedNode.data.delaySeconds || 3}
                          onChange={(e) => updateNodeData({ delaySeconds: parseInt(e.target.value) })}
                          className="w-full accent-accent-600 cursor-pointer"
                        />
                        <div className="flex justify-between mt-2 text-[9px] font-bold text-slate-400 uppercase">
                          <span>1 segundo</span>
                          <span>30 minutos</span>
                        </div>
                        <p className="mt-4 text-[9px] font-medium text-slate-400 uppercase tracking-tight text-center italic">
                          El bot pausará el flujo durante este tiempo antes de continuar al siguiente nodo.
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'webhook' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 font-inter">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Punto de Enlace (URL)</label>
                        <input
                          type="text"
                          value={selectedNode.data.url || ''}
                          onChange={(e) => updateNodeData({ url: e.target.value })}
                          placeholder="https://api.tuempresa.com/webhook"
                          className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-[11px] font-bold outline-none border-2 border-transparent focus:border-accent-500 transition-all font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Método HTTP</label>
                        <div className="grid grid-cols-2 gap-3">
                          {['POST', 'GET'].map(method => (
                            <button
                              key={method}
                              onClick={() => updateNodeData({ method })}
                              className={`py-3 rounded-sm text-[10px] font-black transition-all ${selectedNode.data.method === method ? 'bg-accent-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}
                            >
                              {method}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'condition' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div className="bg-accent-50 dark:bg-accent-500/5 p-5 rounded-sm border border-accent-100 dark:border-accent-500/10 mb-6">
                        <div className="flex items-center gap-3">
                          <GitBranch className="w-5 h-5 text-accent-600" />
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-accent-900 dark:text-accent-400">Condición</h4>
                            <p className="text-[9px] font-bold text-accent-600/70 uppercase">Evalúa y bifurca el flujo</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Variable a Evaluar</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-500 font-black">@</span>
                          <input
                            type="text"
                            value={selectedNode.data.variable || ''}
                            onChange={(e) => updateNodeData({ variable: e.target.value })}
                            placeholder="nombre_usuario"
                            className="w-full pl-8 pr-5 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-xs font-bold outline-none border-2 border-transparent focus:border-amber-500 transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Operador</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: 'exists', label: 'Existe', activeClass: 'bg-emerald-500 text-white border-emerald-500 shadow-md' },
                            { value: 'empty', label: 'Vacío', activeClass: 'bg-slate-500 text-white border-slate-500 shadow-md' },
                            { value: 'equals', label: '==', activeClass: 'bg-blue-500 text-white border-blue-500 shadow-md' },
                            { value: 'notEquals', label: '!=', activeClass: 'bg-rose-500 text-white border-rose-500 shadow-md' },
                            { value: 'contains', label: 'Contiene', activeClass: 'bg-amber-500 text-white border-amber-500 shadow-md' },
                            { value: 'greaterThan', label: '>', activeClass: 'bg-indigo-500 text-white border-indigo-500 shadow-md' },
                          ].map((op) => (
                            <button
                              key={op.value}
                              onClick={() => updateNodeData({ operator: op.value })}
                              className={`py-3 px-3 rounded-sm text-[10px] font-black transition-all border ${(selectedNode.data.operator || 'exists') === op.value
                                ? op.activeClass
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-700'
                                }`}
                            >
                              {op.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {selectedNode.data.operator && !['exists', 'empty'].includes(selectedNode.data.operator) && (
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Valor de Comparación</label>
                          <input
                            type="text"
                            value={selectedNode.data.value || ''}
                            onChange={(e) => updateNodeData({ value: e.target.value })}
                            placeholder="Valor a comparar..."
                            className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-xs font-bold outline-none border-2 border-transparent focus:border-amber-500 transition-all"
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Etiqueta (opcional)</label>
                        <input
                          type="text"
                          value={selectedNode.data.conditionLabel || ''}
                          onChange={(e) => updateNodeData({ conditionLabel: e.target.value })}
                          placeholder="Ej: ¿El usuario tiene email?"
                          className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-xs font-bold outline-none border-2 border-transparent focus:border-amber-500 transition-all"
                        />
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/20 p-3.5 rounded-sm border border-slate-100 dark:border-slate-800">
                        <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Conexiones</h5>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-800/50 rounded-sm border border-emerald-100 dark:border-emerald-900/30">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                            <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">Verdadero (Sí)</span>
                            <span className="text-[8px] text-slate-400 font-medium ml-auto">Conecta aquí si se cumple</span>
                          </div>
                          <div className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-800/50 rounded-sm border border-rose-100 dark:border-rose-900/30">
                            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm" />
                            <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">Falso (No)</span>
                            <span className="text-[8px] text-slate-400 font-medium ml-auto">Conecta aquí si no se cumple</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'handoff' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div className="bg-accent-50 dark:bg-accent-500/5 p-6 rounded-sm border border-accent-100 dark:border-accent-500/10 text-center mb-6">
                        <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-sm shadow-lg flex items-center justify-center mx-auto mb-4 text-accent-600">
                          <HiMiniUserPlus className="w-8 h-8" />
                        </div>
                        <h4 className="text-xs font-black uppercase tracking-tight text-accent-900 dark:text-accent-400 mb-2">Pase a Humano</h4>
                        <p className="text-[10px] font-medium text-accent-600/70 leading-relaxed uppercase">Cuando el flujo llegue a este punto, el bot se pausará y un agente humano podrá tomar la conversación.</p>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Mensaje de Despedida</label>
                        <textarea
                          value={selectedNode.data.message || ''}
                          onChange={(e) => updateNodeData({ message: e.target.value })}
                          placeholder="Ej: Te pondré en contacto con un agente especializado para ayudarte..."
                          className="w-full p-5 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-sm outline-none border-2 border-transparent focus:border-accent-500 transition-all min-h-[120px]"
                        />
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'llm' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div className="bg-accent-50 dark:bg-accent-500/5 p-5 rounded-sm border border-accent-100 dark:border-accent-500/10 mb-6">
                        <div className="flex items-center gap-3">
                          <Sparkles className="w-5 h-5 text-accent-600" />
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-accent-900 dark:text-accent-400">IA Completa</h4>
                            <p className="text-[9px] font-bold text-accent-600/70 uppercase">Genera respuesta con LLM</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Proveedor</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['openai', 'anthropic'].map((p) => (
                            <button key={p} onClick={() => updateNodeData({ provider: p })}
                              className={`py-3 px-4 rounded-sm text-[10px] font-black transition-all border ${(selectedNode.data.provider || '') === p
                                ? 'bg-violet-500 text-white border-violet-500 shadow-md'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-700'
                                }`}>
                              {p === 'openai' ? 'OpenAI' : 'Anthropic'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {(selectedNode.data.provider) && (
                        <>
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Modelo</label>
                            <select value={selectedNode.data.model || ''}
                              onChange={(e) => updateNodeData({ model: e.target.value })}
                              className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-xs font-bold outline-none border-2 border-transparent focus:border-violet-500 transition-all">
                              <option value="">Seleccionar modelo</option>
                              {selectedNode.data.provider === 'openai' ? (
                                <>
                                  <option value="gpt-4o">GPT-4o</option>
                                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                </>
                              ) : (
                                <>
                                  <option value="claude-3-opus">Claude 3 Opus</option>
                                  <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                                  <option value="claude-3-haiku">Claude 3 Haiku</option>
                                </>
                              )}
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Prompt del Sistema</label>
                            <textarea value={selectedNode.data.systemPrompt || ''}
                              onChange={(e) => updateNodeData({ systemPrompt: e.target.value })}
                              placeholder="Eres un asistente de ventas..."
                              className="w-full p-5 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-sm outline-none border-2 border-transparent focus:border-violet-500 transition-all min-h-[100px]" />
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Prompt del Usuario</label>
                            <textarea value={selectedNode.data.userPrompt || ''}
                              onChange={(e) => updateNodeData({ userPrompt: e.target.value })}
                              placeholder="Responde a: {{message}}. Contexto: {{rag_context}}"
                              className="w-full p-5 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-sm outline-none border-2 border-transparent focus:border-violet-500 transition-all min-h-[80px]" />
                            <p className="text-[8px] text-slate-400 mt-2 font-medium">Usa {'{{variable}}'} para insertar datos capturados</p>
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Temperatura: {selectedNode.data.temperature || 0.7}</label>
                            <input type="range" min="0" max="2" step="0.1"
                              value={selectedNode.data.temperature ?? 0.7}
                              onChange={(e) => updateNodeData({ temperature: parseFloat(e.target.value) })}
                              className="w-full accent-violet-500" />
                          </div>

                          {/* Auto-Handoff Section */}
                          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <HiMiniUserPlus className="w-4 h-4 text-red-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Auto-Escalado a Humano</span>
                              </div>
                              <button
                                onClick={() => updateNodeData({ autoHandoff: !selectedNode.data.autoHandoff })}
                                className={`w-10 h-5 rounded-full relative transition-all duration-300 ${selectedNode.data.autoHandoff ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                              >
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${selectedNode.data.autoHandoff ? 'left-6' : 'left-1'}`} />
                              </button>
                            </div>
                            {selectedNode.data.autoHandoff && (
                              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="bg-red-50 dark:bg-red-500/5 p-4 rounded-xl border border-red-100 dark:border-red-500/10 flex items-start gap-3">
                                  <UserCheck className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                  <p className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase leading-tight">
                                    Si la IA no responde con confianza, transfiere a un agente humano.
                                  </p>
                                </div>
                                <div>
                                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">
                                    Umbral de Confianza: {Math.round((selectedNode.data.handoffThreshold ?? 0.6) * 100)}%
                                  </label>
                                  <input type="range" min="0.3" max="0.95" step="0.05"
                                    value={selectedNode.data.handoffThreshold ?? 0.6}
                                    onChange={(e) => updateNodeData({ handoffThreshold: parseFloat(e.target.value) })}
                                    className="w-full accent-red-500" />
                                  <div className="flex justify-between text-[8px] text-slate-400 font-bold mt-1">
                                    <span>Más transferencias</span>
                                    <span>Menos transferencias</span>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Mensaje al escalar</label>
                                  <textarea
                                    value={selectedNode.data.handoffMessage || ''}
                                    onChange={(e) => updateNodeData({ handoffMessage: e.target.value })}
                                    placeholder="Ej: No tengo suficiente información para ayudarte. Conectándote con un agente..."
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs outline-none border-2 border-transparent focus:border-red-500 transition-all min-h-[80px]"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {selectedNode.type === 'knowledge_retrieval' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div className="bg-accent-50 dark:bg-accent-500/5 p-5 rounded-sm border border-accent-100 dark:border-accent-500/10 mb-6">
                        <div className="flex items-center gap-3">
                          <Library className="w-5 h-5 text-accent-600" />
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-accent-900 dark:text-accent-400">Base de Conocimiento</h4>
                            <p className="text-[9px] font-bold text-accent-600/70 uppercase">Recupera contexto relevante</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">ID de Knowledge Base</label>
                        <input type="text" value={selectedNode.data.knowledgeBaseId || ''}
                          onChange={(e) => updateNodeData({ knowledgeBaseId: e.target.value, knowledgeBaseName: e.target.value })}
                          placeholder="kb-xyz..."
                          className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-xs font-bold outline-none border-2 border-transparent focus:border-teal-500 transition-all" />
                        <p className="text-[8px] text-slate-400 mt-2 font-medium">Configura las KBs en Ajustes &gt; Knowledge Bases</p>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Query Template</label>
                        <input type="text" value={selectedNode.data.queryTemplate || ''}
                          onChange={(e) => updateNodeData({ queryTemplate: e.target.value })}
                          placeholder="{{message}}"
                          className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-xs font-bold outline-none border-2 border-transparent focus:border-teal-500 transition-all" />
                        <p className="text-[8px] text-slate-400 mt-2 font-medium">Template para generar la búsqueda. Usa {'{{variable}}'}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Top K</label>
                          <input type="number" min="1" max="20"
                            value={selectedNode.data.topK ?? 3}
                            onChange={(e) => updateNodeData({ topK: parseInt(e.target.value) || 3 })}
                            className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-xs font-bold outline-none border-2 border-transparent focus:border-teal-500 transition-all" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Similitud Mínima</label>
                          <input type="number" min="0" max="1" step="0.05"
                            value={selectedNode.data.minSimilarity ?? 0.7}
                            onChange={(e) => updateNodeData({ minSimilarity: parseFloat(e.target.value) || 0.7 })}
                            className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-xs font-bold outline-none border-2 border-transparent focus:border-teal-500 transition-all" />
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'email' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div className="bg-accent-50 dark:bg-accent-500/5 p-5 rounded-sm border border-accent-100 dark:border-accent-500/10 mb-6">
                        <div className="flex items-center gap-3">
                          <Mail className="w-5 h-5 text-accent-600" />
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-accent-900 dark:text-accent-400">Enviar Correo</h4>
                            <p className="text-[9px] font-bold text-accent-600/70 uppercase">Compone y envía un email saliente</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Destinatario (Para)</label>
                        <input
                          type="email"
                          value={selectedNode.data.toEmail || ''}
                          onChange={(e) => updateNodeData({ toEmail: e.target.value })}
                          placeholder="empresa@ejemplo.com o {{variable}}"
                          className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-xs font-bold outline-none border-2 border-transparent focus:border-sky-500 transition-all"
                        />
                        <p className="mt-2 text-[9px] font-medium text-slate-400">Puedes usar {'{{variable}}'} para insertar el correo capturado del usuario.</p>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">CC (Opcional)</label>
                        <input
                          type="email"
                          value={selectedNode.data.ccEmail || ''}
                          onChange={(e) => updateNodeData({ ccEmail: e.target.value })}
                          placeholder="copia@empresa.com"
                          className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-xs font-bold outline-none border-2 border-transparent focus:border-sky-500 transition-all"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Asunto</label>
                        <input
                          type="text"
                          value={selectedNode.data.subject || ''}
                          onChange={(e) => updateNodeData({ subject: e.target.value })}
                          placeholder="Ej: Información solicitada por {{nombre}}"
                          className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-xs font-bold outline-none border-2 border-transparent focus:border-sky-500 transition-all"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block">Cuerpo del Correo</label>
                        <div className="relative group">
                          <textarea
                            id="node-email-body"
                            value={selectedNode.data.emailBody || ''}
                            onChange={(e) => updateNodeData({ emailBody: e.target.value })}
                            placeholder="Escribe el contenido del correo aquí. Usa {{variable}} para personalizar."
                            className="w-full p-5 bg-slate-50 dark:bg-slate-800/50 rounded-sm text-sm font-medium resize-none outline-none border-2 border-transparent focus:border-sky-500 transition-all min-h-[200px] shadow-inner"
                            rows={8}
                          />
                          <div className="absolute bottom-4 right-4 flex gap-2">
                            <button
                              onClick={() => insertFormatting('node-email-body', 'bold', 'text')}
                              className="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-700 rounded-sm shadow text-sm font-black hover:scale-105 transition-all border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                              title="Negrita"
                            >B</button>
                            <button
                              onClick={() => insertFormatting('node-email-body', 'italic', 'text')}
                              className="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-700 rounded-sm shadow text-sm italic hover:scale-105 transition-all border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                              title="Cursiva"
                            >I</button>
                          </div>
                        </div>
                        <p className="mt-3 text-[9px] font-bold text-slate-400 uppercase tracking-tight text-center italic">
                          Usa {'{{nombre}}'}, {'{{empresa}}'} u otras variables capturadas para personalizar.
                        </p>
                      </div>

                      <div className="bg-sky-50 dark:bg-sky-900/10 p-4 rounded-sm border border-sky-100 dark:border-sky-800/30">
                        <p className="text-[9px] font-bold text-sky-700 dark:text-sky-400 uppercase leading-relaxed">
                          💡 El correo se enviará automáticamente cuando el flujo llegue a este nodo. Configura el servidor SMTP en Ajustes → Integraciones → Email.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Conexiones del nodo */}
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50">
                    <details className="group bg-slate-50 dark:bg-slate-800/20 rounded-sm border border-slate-100 dark:border-slate-800/50 overflow-hidden">
                      <summary className="flex items-center gap-2 px-3.5 py-2.5 cursor-pointer font-black text-[9px] uppercase tracking-widest text-slate-400 select-none">
                        <span className="flex items-center gap-1.5 text-accent-600 dark:text-accent-500">
                          <HiMiniPlus className="w-3 h-3 rotate-45" />
                          Conexiones
                        </span>
                        <span className="text-[8px] font-black text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-1.5 py-0.5 rounded-sm">{incomingEdges.length + outgoingEdges.length}</span>
                        <span className="ml-auto flex items-center gap-2.5 text-[8px] font-bold text-slate-400">
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Entrada</span>
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-accent-500" /> Salida</span>
                          <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform text-slate-400" />
                        </span>
                      </summary>
                      <div className="px-3.5 pb-3.5 space-y-3">
                        <div>
                          <p className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-emerald-500 mb-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> De Entrada
                          </p>
                          {incomingEdges.length > 0 ? (
                            <div className="space-y-1.5">
                              {incomingEdges.map(e => {
                                const sourceNode = nodes.find(n => n.id === e.source);
                                return (
                                  <div key={e.id} className="group/conn flex items-center justify-between gap-2 px-2.5 py-2 bg-white dark:bg-slate-800/50 rounded-sm border border-slate-100 dark:border-slate-700">
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 truncate">
                                        {sourceNode?.type === 'interactive' && e.sourceHandle ? (
                                          `Botón: ${sourceNode.data.buttons?.find((b: any) => b.id === e.sourceHandle)?.text || 'Opción'}`
                                        ) : sourceNode?.type === 'confirmation' && e.sourceHandle ? (
                                          e.sourceHandle === 'confirm_yes' ? 'Sí (confirmar)' : e.sourceHandle === 'confirm_no' ? 'No (repetir/volver)' : 'Confirmación'
                                        ) : (
                                          sourceNode?.type || 'Nodo'
                                        )}
                                      </span>
                                      <span className="text-[8px] font-bold text-slate-400 truncate">
                                        {sourceNode?.data.text || sourceNode?.data.bodyText || sourceNode?.data.question || (sourceNode?.data.keywords?.join(', ')) || 'Sin contenido'}
                                      </span>
                                    </div>
                                    <button onClick={() => setEdges(eds => eds.filter(ed => ed.id !== e.id))} className="p-1.5 text-rose-500 opacity-0 group-hover/conn:opacity-100 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-sm transition-all shrink-0">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[9px] italic text-slate-400 font-medium text-center py-2.5">Sin conexiones de entrada</p>
                          )}
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-accent-500 mb-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent-500" /> De Salida
                          </p>
                          {outgoingEdges.length > 0 ? (
                            <div className="space-y-1.5">
                              {outgoingEdges.map(e => {
                                const targetNode = nodes.find(n => n.id === e.target);
                                return (
                                  <div key={e.id} className="group/conn flex items-center justify-between gap-2 px-2.5 py-2 bg-white dark:bg-slate-800/50 rounded-sm border border-slate-100 dark:border-slate-700">
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 truncate">
                                        {selectedNode.type === 'interactive' && e.sourceHandle ? (
                                          `Desde: ${selectedNode.data.buttons?.find((b: any) => b.id === e.sourceHandle)?.text || 'Botón'}`
                                        ) : selectedNode.type === 'confirmation' && e.sourceHandle ? (
                                          e.sourceHandle === 'confirm_yes' ? `Desde: ${selectedNode.data.yesLabel || 'Sí'}` : e.sourceHandle === 'confirm_no' ? `Desde: ${selectedNode.data.noLabel || 'No'}` : 'Desde: Confirmación'
                                        ) : (
                                          targetNode?.type || 'Siguiente'
                                        )}
                                      </span>
                                      <span className="text-[8px] font-bold text-slate-400 truncate">
                                        {targetNode?.data.text || targetNode?.data.bodyText || targetNode?.data.question || 'Conectado'}
                                      </span>
                                    </div>
                                    <button onClick={() => setEdges(eds => eds.filter(ed => ed.id !== e.id))} className="p-1.5 text-rose-500 opacity-0 group-hover/conn:opacity-100 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-sm transition-all shrink-0">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[9px] italic text-slate-400 font-medium text-center py-2.5">Sin conexiones de salida</p>
                          )}
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {showSimulator && <FlowSimulator nodes={nodes} edges={edges} matchingStrategy={matchingStrategy} onClose={() => setShowSimulator(false)} />}
      </div>

      <ConfirmDialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={confirmClearCanvas}
        title="Limpiar flow"
        message="¿Limpiar todo el flow? Se eliminarán todos los nodos y conexiones. Esta acción no se puede deshacer."
        confirmText="Limpiar"
        variant="danger"
      />
    </div>
  );
};
