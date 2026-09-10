import { Bot, Sparkles, Smartphone, MessageSquare } from 'lucide-react';

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'sales' | 'support' | 'marketing' | 'onboarding' | 'other';
  triggers: string[];
  icon: any;
  accent: string;
  matchingStrategy?: 'strict' | 'flexible';
  reactivationTime?: number;
  nodes: any[];
  edges: any[];
}

// Genera ids estables y únicos para cada plantilla (td = template deploy,
// prefijados con el id de la plantilla para que no colisionen entre sí).
const nid = (tpl: string, key: string) => `${tpl}_${key}`;

// ────────────────────────────────────────────────────────────────────────────
// Plantilla 1: Bienvenida + Menú principal (ventas/soporte)
// ────────────────────────────────────────────────────────────────────────────
const welcomeMenu: FlowTemplate = {
  id: 'welcome_menu',
  name: 'Bienvenida + Menú',
  description: 'Saludo inicial con botones para ver productos, hablar con un agente o consultar soporte.',
  category: 'marketing',
  triggers: ['hola', 'buenos dias', 'menu', 'inicio', 'empezar'],
  icon: MessageSquare,
  accent: 'from-violet-500 to-purple-600',
  matchingStrategy: 'flexible',
  reactivationTime: 30,
  nodes: [
    {
      id: nid('welcome_menu', 'trigger'),
      type: 'trigger',
      position: { x: 350, y: 60 },
      data: { label: 'trigger', text: '', keywords: ['hola', 'menu', 'inicio', 'empezar', 'buenos dias'], matchingStrategy: 'flexible', reactivationTime: 30 },
    },
    {
      id: nid('welcome_menu', 'saludo'),
      type: 'text',
      position: { x: 300, y: 260 },
      data: {
        label: 'text', text: '¡Hola! 👋 Bienvenido a nuestro servicio. ¿En qué podemos ayudarte hoy?\n\nSelecciona una opción para continuar:',
      },
    },
    {
      id: nid('welcome_menu', 'menu'),
      type: 'interactive',
      position: { x: 280, y: 460 },
      data: {
        label: 'interactive', text: '', bodyText: 'Elige una opción:',
        buttons: [
          { id: nid('welcome_menu', 'btn_productos'), text: '🛍️ Ver productos' },
          { id: nid('welcome_menu', 'btn_humano'), text: '👤 Hablar con un agente' },
          { id: nid('welcome_menu', 'btn_soporte'), text: '🛠️ Soporte' },
        ],
      },
    },
    {
      id: nid('welcome_menu', 'productos'),
      type: 'text',
      position: { x: 20, y: 720 },
      data: { label: 'text', text: 'Te mostraremos nuestro catálogo de productos en breve. 🛍️' },
    },
    {
      id: nid('welcome_menu', 'humano'),
      type: 'handoff',
      position: { x: 380, y: 720 },
      data: { label: 'handoff', text: '', message: 'Un agente te atenderá en un momento. Por favor espera. 🙌' },
    },
    {
      id: nid('welcome_menu', 'soporte'),
      type: 'text',
      position: { x: 780, y: 720 },
      data: { label: 'text', text: 'Nuestro equipo de soporte está disponible para ayudarte. ¡Escríbenos tu consulta!' },
    },
  ],
  edges: [
    { id: 'e1', source: nid('welcome_menu', 'trigger'), target: nid('welcome_menu', 'saludo') },
    { id: 'e2', source: nid('welcome_menu', 'saludo'), target: nid('welcome_menu', 'menu') },
    { id: 'e3', source: nid('welcome_menu', 'menu'), target: nid('welcome_menu', 'productos'), sourceHandle: nid('welcome_menu', 'btn_productos') },
    { id: 'e4', source: nid('welcome_menu', 'menu'), target: nid('welcome_menu', 'humano'), sourceHandle: nid('welcome_menu', 'btn_humano') },
    { id: 'e5', source: nid('welcome_menu', 'menu'), target: nid('welcome_menu', 'soporte'), sourceHandle: nid('welcome_menu', 'btn_soporte') },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// Plantilla 2: Ventas — captura de datos y derivación
// ────────────────────────────────────────────────────────────────────────────
const salesFunnel: FlowTemplate = {
  id: 'sales_funnel',
  name: 'Embudo de Ventas',
  description: 'Recibe pedidos: saluda, captura nombre y teléfono, confirma y deriva a un asesor.',
  category: 'sales',
  triggers: ['precio', 'comprar', 'pedido', 'producto', 'venta'],
  icon: Bot,
  accent: 'from-emerald-500 to-teal-600',
  matchingStrategy: 'strict',
  reactivationTime: 60,
  nodes: [
    {
      id: nid('sales_funnel', 'trigger'),
      type: 'trigger',
      position: { x: 60, y: 40 },
      data: { label: 'trigger', text: '', keywords: ['precio', 'comprar', 'pedido', 'producto', 'venta'], matchingStrategy: 'strict', reactivationTime: 60 },
    },
    {
      id: nid('sales_funnel', 'saludo'),
      type: 'text',
      position: { x: 40, y: 220 },
      data: { label: 'text', text: '¡Hola! Nos alegra tu interés. Para procesar tu solicitud necesitamos algunos datos. 💬' },
    },
    {
      id: nid('sales_funnel', 'nombre'),
      type: 'capture',
      position: { x: 200, y: 400 },
      data: { label: 'capture', text: '', question: '¿Cuál es tu nombre?', variableName: 'nombre' },
    },
    {
      id: nid('sales_funnel', 'telefono'),
      type: 'capture_phone',
      position: { x: 200, y: 600 },
      data: { label: 'capture_phone', text: '', question: '¿Cuál es tu número de celular?', variableName: 'telefono', validationType: 'phone' },
    },
    {
      id: nid('sales_funnel', 'producto'),
      type: 'capture',
      position: { x: 200, y: 800 },
      data: { label: 'capture', text: '', question: '¿Qué producto te interesa?', variableName: 'producto' },
    },
    {
      id: nid('sales_funnel', 'confirmacion'),
      type: 'text',
      position: { x: 180, y: 1000 },
      data: { label: 'text', text: '¡Gracias {{nombre}}! ✅ Hemos registrado tu pedido de "{{producto}}". Un asesor te contactará al {{telefono}} para coordinar la entrega.' },
    },
    {
      id: nid('sales_funnel', 'agente'),
      type: 'handoff',
      position: { x: 500, y: 1000 },
      data: { label: 'handoff', text: '', message: 'Un asesor de ventas te atenderá en breve. 🛍️' },
    },
  ],
  edges: [
    { id: 'e1', source: nid('sales_funnel', 'trigger'), target: nid('sales_funnel', 'saludo') },
    { id: 'e2', source: nid('sales_funnel', 'saludo'), target: nid('sales_funnel', 'nombre') },
    { id: 'e3', source: nid('sales_funnel', 'nombre'), target: nid('sales_funnel', 'telefono') },
    { id: 'e4', source: nid('sales_funnel', 'telefono'), target: nid('sales_funnel', 'producto') },
    { id: 'e5', source: nid('sales_funnel', 'producto'), target: nid('sales_funnel', 'confirmacion') },
    { id: 'e6', source: nid('sales_funnel', 'confirmacion'), target: nid('sales_funnel', 'agente') },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// Plantilla 3: Soporte / Captura de datos básica
// ────────────────────────────────────────────────────────────────────────────
const supportFlow: FlowTemplate = {
  id: 'support_flow',
  name: 'Soporte al Cliente',
  description: 'Responde inquietudes, captura datos del contacto y deriva a soporte humano.',
  category: 'support',
  triggers: ['soporte', 'ayuda', 'problema', 'error', 'reclamo'],
  icon: Sparkles,
  accent: 'from-blue-500 to-indigo-600',
  matchingStrategy: 'flexible',
  reactivationTime: 30,
  nodes: [
    {
      id: nid('support_flow', 'trigger'),
      type: 'trigger',
      position: { x: 90, y: 40 },
      data: { label: 'trigger', text: '', keywords: ['soporte', 'ayuda', 'problema', 'error', 'reclamo'], matchingStrategy: 'flexible', reactivationTime: 30 },
    },
    {
      id: nid('support_flow', 'saludo'),
      type: 'text',
      position: { x: 70, y: 220 },
      data: { label: 'text', text: 'Hola, ¿cómo podemos ayudarte? 😊 Cuéntanos brevemente el problema.' },
    },
    {
      id: nid('support_flow', 'telefono'),
      type: 'capture_phone',
      position: { x: 70, y: 400 },
      data: { label: 'capture_phone', text: '', question: 'Para poder ayudarte mejor, ¿me confirmas tu número de celular?', variableName: 'telefono', validationType: 'phone' },
    },
    {
      id: nid('support_flow', 'agente'),
      type: 'handoff',
      position: { x: 70, y: 600 },
      data: { label: 'handoff', text: '', message: 'Un agente de soporte revisará tu caso y te contactará al {{telefono}}. 🙌' },
    },
  ],
  edges: [
    { id: 'e1', source: nid('support_flow', 'trigger'), target: nid('support_flow', 'saludo') },
    { id: 'e2', source: nid('support_flow', 'saludo'), target: nid('support_flow', 'telefono') },
    { id: 'e3', source: nid('support_flow', 'telefono'), target: nid('support_flow', 'agente') },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// Plantilla 4: Asistente con IA (RAG + handoff)
// ────────────────────────────────────────────────────────────────────────────
const aiAssistant: FlowTemplate = {
  id: 'ai_assistant',
  name: 'Asistente IA',
  description: 'Usa IA y base de conocimiento para responder, con escalado automático a un humano.',
  category: 'other',
  triggers: ['consulta', 'info', 'pregunta', 'ayuda', 'informacion'],
  icon: Smartphone,
  accent: 'from-rose-500 to-pink-600',
  matchingStrategy: 'flexible',
  reactivationTime: 30,
  nodes: [
    {
      id: nid('ai_assistant', 'trigger'),
      type: 'trigger',
      position: { x: 300, y: 40 },
      data: { label: 'trigger', text: '', keywords: ['consulta', 'info', 'pregunta', 'ayuda', 'informacion'], matchingStrategy: 'flexible', reactivationTime: 30 },
    },
    {
      id: nid('ai_assistant', 'bienvenida'),
      type: 'text',
      position: { x: 260, y: 220 },
      data: { label: 'text', text: '¡Hola! Soy el asistente virtual. Puedo responder tus consultas al instante. 🤖' },
    },
    {
      id: nid('ai_assistant', 'kb'),
      type: 'knowledge_retrieval',
      position: { x: 240, y: 400 },
      data: {
        label: 'knowledge_retrieval', text: '',
        knowledgeBaseId: '', knowledgeBaseName: 'Selecciona una base de conocimiento',
        queryTemplate: '{{user_input}}', topK: 3, minSimilarity: 0.7,
      },
    },
    {
      id: nid('ai_assistant', 'llm'),
      type: 'llm',
      position: { x: 240, y: 600 },
      data: {
        label: 'llm', text: '',
        provider: 'openai', model: 'gpt-4o',
        systemPrompt: 'Eres el asistente virtual de la empresa. Responde con amabilidad y concisión usando el contexto disponible.',
        userPrompt: '{{user_input}}', temperature: 0.7,
        autoHandoff: true, handoffThreshold: 0.6,
        handoffMessage: 'Un agente humano te atenderá en breve.',
      },
    },
    {
      id: nid('ai_assistant', 'agente'),
      type: 'handoff',
      position: { x: 240, y: 800 },
      data: { label: 'handoff', text: '', message: 'Solicité ayuda a un agente humano para resolver tu consulta. 🙌' },
    },
  ],
  edges: [
    { id: 'e1', source: nid('ai_assistant', 'trigger'), target: nid('ai_assistant', 'bienvenida') },
    { id: 'e2', source: nid('ai_assistant', 'bienvenida'), target: nid('ai_assistant', 'kb') },
    { id: 'e3', source: nid('ai_assistant', 'kb'), target: nid('ai_assistant', 'llm') },
    { id: 'e4', source: nid('ai_assistant', 'llm'), target: nid('ai_assistant', 'agente') },
  ],
};

export const flowTemplates: FlowTemplate[] = [
  welcomeMenu,
  salesFunnel,
  supportFlow,
  aiAssistant,
];
