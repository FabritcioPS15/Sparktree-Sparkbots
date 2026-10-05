import dotenv from 'dotenv';
// Load environment variables immediately
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
// import { Server } from 'socket.io';
import promClient from 'prom-client';

// Import all routes
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/users.routes';
import conversationRoutes from './modules/chat/conversations.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import settingsRoutes from './modules/settings/settings.routes';
import flowRoutes from './modules/bots/bots.routes';
import leadRoutes from './modules/leads/leads.routes';
import crmRoutes from './modules/crm/crm.routes';
import qrRoutes from './modules/integrations/qr.routes';
import whatsappConnectionsRoutes from './modules/integrations/whatsappConnections.routes';
import whatsappQRRoutes from './modules/integrations/whatsappQR.routes';
import adminRoutes from './modules/admin/admin.routes';
import debugRoutes from './modules/system/debug.routes';
import multiWhatsAppRoutes from './modules/integrations/multiWhatsApp.routes';
import platformRoutes from './modules/integrations/platform.routes';
import webhookRoutes from './modules/system/webhooks.routes';
import { verifyWebhook, handleIncomingWebhook } from './modules/system/webhookController';
import assignmentRoutes from './modules/chat/assignment.routes';
import internalNotesRoutes from './modules/chat/internalNotes.routes';
import inboxRoutes from './modules/chat/inbox.routes';
import catalogsRoutes from './modules/catalogs/catalogs.routes';
import knowledgeRoutes from './modules/knowledge/knowledge.routes';
import billingRoutes from './modules/billing/billing.routes';
import aiRoutes from './modules/ai/ai.routes';
import calendarRoutes from './modules/calendar/calendar.routes';
import businessHoursRoutes from './modules/automation/businessHours.routes';
import promotionsRoutes from './modules/promotions/promotions.routes';
import quotesRoutes from './modules/crm/quotes.routes';
import ordersRoutes from './modules/orders/orders.routes';
import campaignRoutes from './modules/campaigns/campaigns.routes';
import reminderRoutes from './modules/reminders/reminders.routes';
import messageTemplateRoutes from './modules/templates/messageTemplates.routes';
import auditRoutes from './modules/audit/audit.routes';

import { securityHeaders, globalRateLimit, apiRateLimit, authRateLimit } from './security/middleware/security.middleware';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// WebSocket setup for real-time connection status (RF-02)
// const io = new Server(httpServer, {
//   cors: {
//     origin: process.env.FRONTEND_URL || 'http://localhost:5173',
//     credentials: true,
//   },
// });

// Export io instance for use in services
// export { io };
export const io = null as any;

// Prometheus metrics setup
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const activeConnections = new promClient.Gauge({
  name: 'websocket_active_connections',
  help: 'Number of active WebSocket connections',
  registers: [register]
});

const workflowExecutionsTotal = new promClient.Counter({
  name: 'workflow_executions_total',
  help: 'Total number of workflow executions',
  labelNames: ['workflow_id', 'status'],
  registers: [register]
});

const workflowExecutionDuration = new promClient.Histogram({
  name: 'workflow_execution_duration_seconds',
  help: 'Duration of workflow executions in seconds',
  labelNames: ['workflow_id'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register]
});

// Export metrics for use in other modules
export { httpRequestDuration, httpRequestsTotal, activeConnections, workflowExecutionsTotal, workflowExecutionDuration };

// --- CLEAN CONSOLE PATCH ---
// Some internal libraries (like libsignal used by WhatsApp) spam the console with giant objects
const originalConsoleLog = console.log;
console.log = function (...args) {
  if (typeof args[0] === 'string' && args[0].includes('Closing session: SessionEntry')) {
    return; // Ignore this noisy log
  }
  originalConsoleLog.apply(console, args);
};
// ---------------------------

// Middleware
const allowedOrigins: string[] = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://192.168.1.63:5173',
  'http://192.168.191.131:5173',
  'http://192.168.1.63:5174',
  'http://192.168.191.131:5174'
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Security headers (helmet) + custom hardening
app.use(helmet());
app.use(securityHeaders);

// Global rate limit per IP (webhooks y rutas públicas incluidas)
app.use(globalRateLimit);

// Initialize request start time BEFORE body parsing so that errors raised
// by express.json (e.g. malformed JSON) still have a valid startTime.
app.use((req, res, next) => {
  if (!(req as any).startTime) (req as any).startTime = Date.now();
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Prevention of ERR_HTTP_HEADERS_SENT after timeout
app.use((req, res, next) => {
  const originalStatus = res.status;
  const originalSend = res.send;
  const originalJson = res.json;
  const originalSetHeader = res.setHeader;

  res.status = function (code) {
    if (res.headersSent) return this;
    return originalStatus.call(this, code);
  };

  res.send = function (body) {
    if (res.headersSent) return this;
    return originalSend.call(this, body);
  };

  res.json = function (obj) {
    if (res.headersSent) return this;
    return originalJson.call(this, obj);
  };

  res.setHeader = function (name, value) {
    if (res.headersSent) return this;
    try {
      return originalSetHeader.call(this, name, value);
    } catch (e) {
      return this;
    }
  };

  next();
});

// Request timeout middleware (RNF-02: 3-second response time, configurable via env)
app.use((req, res, next) => {
  const timeoutMs = parseInt(process.env.REQUEST_TIMEOUT_MS || '10000', 10);
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error(`[Timeout] Request to ${req.originalUrl} exceeded ${timeoutMs / 1000} seconds`);
      res.status(504).json({
        error: 'Gateway Timeout',
        message: 'Request processing exceeded time limit',
        timestamp: new Date().toISOString()
      });
    }
  }, timeoutMs);

  res.on('finish', () => {
    clearTimeout(timeout);
  });

  next();
});

// Request Logger (RNF-07: Centralized logging to Docker stdout)
const methodColors: Record<string, string> = {
  GET: '\x1b[32m',    // Green
  POST: '\x1b[34m',   // Blue
  PUT: '\x1b[33m',    // Yellow
  DELETE: '\x1b[31m', // Red
  PATCH: '\x1b[35m',  // Magenta
  OPTIONS: '\x1b[36m' // Cyan
};
const resetColor = '\x1b[0m';
const dimColor = '\x1b[2m';

app.use((req, res, next) => {
  // Ignorar rutas ruidosas (polling del frontend) para mantener limpia la consola
  const noisyRoutes = [
    '/api/leads',
    '/api/platform/connections',
    '/api/qr/status',
    '/api/conversations',
    '/api/reminders'
  ];
  const isNoisy = noisyRoutes.some(route => req.originalUrl.startsWith(route)) && req.method === 'GET';

  if (!isNoisy) {
    const time = new Date().toLocaleTimeString('es-ES', { hour12: false });
    const mColor = methodColors[req.method] || '\x1b[37m'; // White default
    const bodyStr = Object.keys(req.body || {}).length > 0
      ? `\n${dimColor}↳ Body: ${JSON.stringify(req.body).substring(0, 200)}${resetColor}`
      : '';

    console.log(`${dimColor}[${time}]${resetColor} ${mColor}${req.method.padEnd(6)}${resetColor} ${req.originalUrl}${bodyStr}`);
  }

  // Start timing for Prometheus metrics
  const start = Date.now();

  // Store start time on request for later use
  (req as any).startTime = start;

  next();
});



// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'SparkBot SaaS Backend'
  });
});

// Prometheus metrics endpoint
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err instanceof Error ? err.message : 'Error generating metrics');
  }
});

// API Routes
app.use('/api/auth', authRateLimit, authRoutes);

// Auth and Tenant Middleware (Applied to all following /api routes)
import { authenticateToken } from './core/middleware/auth';
import { tenantMiddleware } from './core/middleware/tenant';

// Webhook routes (no auth required - Meta sends no auth headers)
app.get('/api/webhook', verifyWebhook);
app.post('/api/webhook', handleIncomingWebhook);
app.use('/api/webhooks', webhookRoutes);

// Enforce authentication + tenant isolation + API rate limit on every /api request
app.use('/api', apiRateLimit);
app.use('/api', authenticateToken);
app.use('/api', tenantMiddleware);

app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/flows', flowRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/whatsapp-connections', whatsappConnectionsRoutes);
app.use('/api/whatsapp-qr', whatsappQRRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/multi-whatsapp', multiWhatsAppRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/assignment', assignmentRoutes);
app.use('/api/internal-notes', internalNotesRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/catalogs', catalogsRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/business-hours', businessHoursRoutes);
app.use('/api/promotions', promotionsRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/message-templates', messageTemplateRoutes);
app.use('/api/audit-logs', auditRoutes);

// Middleware to record metrics for all successful responses
app.use((req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json;
  res.json = function (data) {
    // Record metrics for successful responses
    const duration = (Date.now() - ((req as any).startTime || Date.now())) / 1000;
    const statusCode = res.statusCode;
    httpRequestDuration.observe(
      { method: req.method, route: req.route?.path || req.path, status_code: statusCode },
      duration
    );
    httpRequestsTotal.inc({ method: req.method, route: req.route?.path || req.path, status_code: statusCode });

    return originalJson.call(this, data);
  };
  next();
});

// Webhook routes moved above tenantMiddleware

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', err);

  if (res.headersSent) {
    return next(err);
  }

  // Record metrics for error responses
  const duration = (Date.now() - ((req as any).startTime || Date.now())) / 1000;
  httpRequestDuration.observe(
    { method: req.method, route: req.route?.path || req.path, status_code: 500 },
    duration
  );
  httpRequestsTotal.inc({ method: req.method, route: req.route?.path || req.path, status_code: 500 });

  res.status(err.status || err.statusCode || 500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  // Record metrics for 404 responses
  const duration = (Date.now() - ((req as any).startTime || Date.now())) / 1000;
  httpRequestDuration.observe(
    { method: req.method, route: req.route?.path || req.path, status_code: 404 },
    duration
  );
  httpRequestsTotal.inc({ method: req.method, route: req.route?.path || req.path, status_code: 404 });

  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
import { multiWhatsAppService } from './modules/integrations/multiWhatsAppService';
import { multiPlatformService } from './modules/integrations/platform/multiPlatformService';
import { campaignsService } from './modules/campaigns/campaigns.service';
import { remindersService } from './modules/reminders/reminders.service';

// WebSocket connection handling (RF-02) - temporarily disabled
// io.on('connection', (socket: any) => {
//   console.log(`[WebSocket] Client connected: ${socket.id}`);

//   socket.on('join-organization', (organizationId: string) => {
//     socket.join(`org:${organizationId}`);
//     console.log(`[WebSocket] Client ${socket.id} joined organization ${organizationId}`);
//   });

//   socket.on('leave-organization', (organizationId: string) => {
//     socket.leave(`org:${organizationId}`);
//     console.log(`[WebSocket] Client ${socket.id} left organization ${organizationId}`);
//   });

//   socket.on('disconnect', () => {
//     console.log(`[WebSocket] Client disconnected: ${socket.id}`);
//     activeConnections.dec();
//   });
// });

httpServer.listen(PORT, async () => {
  console.log(`🚀 SparkBot SaaS Backend running on port ${PORT}`);
  console.log(`🔌 WebSocket server enabled for real-time updates`);

  // Initialize WhatsApp connections
  try {
    await multiWhatsAppService.initializeAllConnections();
  } catch (error) {
    console.error('Failed to initialize WhatsApp connections:', error);
  }

  // Initialize multi-platform connections (Telegram, Instagram, TikTok)
  try {
    await multiPlatformService.initializeAllConnections();
  } catch (error) {
    console.error('Failed to initialize multi-platform connections:', error);
  }

  // Recuperar campañas que quedaron a medio enviar tras un reinicio
  try {
    await campaignsService.recoverInterruptedCampaigns();
  } catch (error) {
    console.error('Failed to recover interrupted campaigns:', error);
  }

  // Recuperar recordatorios que quedaron a medio enviar tras un reinicio
  try {
    await remindersService.recoverInterruptedReminders();
  } catch (error) {
    console.error('Failed to recover interrupted reminders:', error);
  }

  // Iniciar scheduler de recordatorios programados/recurrentes
  remindersService.startScheduler();

  console.log(`📊 API Documentation: http://localhost:${PORT}/api`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📱 WhatsApp Connections API: http://localhost:${PORT}/api/whatsapp-connections`);
  console.log(`📸 QR API: http://localhost:${PORT}/api/qr`);
  console.log(`🌐 Platform Connections API: http://localhost:${PORT}/api/platform/connections`);
  console.log(`🔗 Webhooks: http://localhost:${PORT}/api/webhooks`);

  // Start ngrok forwarding for webhooks (dev only)
  if (process.env.NODE_ENV !== 'production') {
    try {
      const ngrok = require("@ngrok/ngrok");
      const forwarder = await ngrok.forward({
        addr: PORT,
        authtoken_from_env: true,
      });
      console.log(`🌐 Ngrok available at: ${forwarder.url()}`);
    } catch (error) {
      console.error("Failed to start ngrok:", error);
    }
  }
});

export default app;
