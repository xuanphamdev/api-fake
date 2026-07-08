import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { prisma } from 'db';
import { matchRoute } from './matcher.js';
import { startLogPruner } from './cron.js';
import { executeScriptInSandbox } from './sandbox.js';
import { loggerBuffer } from './logger-buffer.js';
import { decrypt } from './crypto.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Dynamic CORS configuration delegate querying DB configuration dynamically
const corsOptionsDelegate = async (req: any, callback: any) => {
  const parts = req.path.split('/');
  // Match path /mock/:projectSlug/*
  if (parts[1] === 'mock' && parts[2]) {
    const projectSlug = parts[2];
    try {
      const project = await prisma.project.findUnique({
        where: { slug: projectSlug },
      });

      if (project) {
        let origin: any = true;
        if (project.corsOrigins) {
          if (project.corsOrigins === '*') {
            origin = '*';
          } else {
            origin = project.corsOrigins.split(',').map((o: string) => o.trim());
          }
        }

        const corsOptions = {
          origin,
          methods: project.corsMethods ? project.corsMethods.split(',').map((m: string) => m.trim().toUpperCase()) : ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
          allowedHeaders: project.corsHeaders ? project.corsHeaders.split(',').map((h: string) => h.trim()) : undefined,
          credentials: project.corsCredentials,
        };
        return callback(null, corsOptions);
      }
    } catch (e) {
      console.error('[CORS-DELEGATE] Error resolving custom CORS from database:', e);
    }
  }

  // Fallback default CORS policy
  callback(null, { origin: true });
};

app.use(cors(corsOptionsDelegate));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to mock endpoints to protect against DoS/Slowloris attacks
const mockLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Start background pruner task
startLogPruner();

// Catch-all route for Mock Gateway
app.all('/mock/:projectSlug/*', mockLimiter, async (req, res) => {
  const { projectSlug } = req.params;
  const mockPath = '/' + (req.params as any)[0]; // e.g. "users/123" -> "/users/123"
  const method = req.method;

  const startTime = Date.now();

  try {
    // 1. Fetch project and its endpoints, including Secrets relation
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      include: {
        endpoints: true,
        secrets: true,
      },
    });

    if (!project) {
      return res.status(404).json({ error: `Mock Project '${projectSlug}' not found` });
    }

    // 2. Security Auth Gate (API Key Verification - Phase 4)
    if (project.enforceApiKey) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing API Key' });
      }
      const token = authHeader.substring(7);
      const apiKey = await prisma.apiKey.findFirst({
        where: { key: token, projectId: project.id },
      });
      if (!apiKey) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
      }
    }

    // 3. Match requested path against project endpoints
    const match = matchRoute(method, mockPath, project.endpoints);

    if (!match) {
      return res.status(404).json({
        error: `No mock endpoint found for path '${mockPath}' and method '${method}'`,
      });
    }

    const { endpoint, params } = match;

    let statusCode = endpoint.statusCode || 200;
    let resHeaders = (endpoint.headers as Record<string, string>) || {};
    let resBody = endpoint.responseBody || '';
    let executionError: string | null = null;

    // 4. Decrypt Project environment secrets (Phase 2)
    const decryptedSecrets: Record<string, string> = {};
    if (project.secrets) {
      project.secrets.forEach((sec: { key: string; encryptedValue: string }) => {
        decryptedSecrets[sec.key] = decrypt(sec.encryptedValue);
      });
    }

    // 5. Execute Script inside Sandbox if defined
    if (endpoint.script) {
      const reqContext = {
        method,
        headers: req.headers,
        query: req.query,
        body: req.body,
        params,
      };

      try {
        const sandboxedRes = await executeScriptInSandbox(reqContext, endpoint.script, decryptedSecrets);
        statusCode = sandboxedRes.statusCode;
        resHeaders = { ...resHeaders, ...sandboxedRes.headers };
        resBody = sandboxedRes.body;
      } catch (err: any) {
        console.error(`[SANDBOX-ERROR] on endpoint ${endpoint.id}:`, err.message);
        executionError = err.message;
        statusCode = 500;
        resBody = JSON.stringify({
          error: 'Dynamic Script Execution Failed',
          details: err.message,
        });
        resHeaders = { ...resHeaders, 'Content-Type': 'application/json' };
      }
    }

    // Apply configured delay (capped at 2000ms max to prevent connection starvation)
    const delay = Math.min(endpoint.delay || 0, 2000);
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Send headers
    Object.entries(resHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Write log entry asynchronously to the buffer
    const duration = Date.now() - startTime;
    loggerBuffer.logRequest({
      endpointId: endpoint.id,
      method,
      path: req.originalUrl,
      reqHeaders: req.headers,
      reqQuery: req.query,
      reqBody: req.body,
      resHeaders,
      resStatus: statusCode,
      resBody: typeof resBody === 'object' ? JSON.stringify(resBody) : resBody,
      duration,
    });

    // Dispatch out-of-band Webhook (Phase 3)
    if (project.webhookUrl) {
      const webhookPayload = {
        event: 'request.logged',
        project: project.slug,
        request: {
          method,
          path: req.originalUrl,
          headers: req.headers,
          query: req.query,
          body: req.body,
        },
        response: {
          status: statusCode,
          headers: resHeaders,
          body: typeof resBody === 'object' ? JSON.stringify(resBody) : resBody,
        },
        duration,
        timestamp: new Date().toISOString(),
      };

      fetch(project.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      }).catch((e: any) => {
        console.error(`[WEBHOOK-ERROR] failed to dispatch to ${project.webhookUrl}:`, e.message);
      });
    }

    // Return response
    if (typeof resBody === 'string') {
      try {
        const parsed = JSON.parse(resBody);
        return res.status(statusCode).json(parsed);
      } catch (e) {
        return res.status(statusCode).send(resBody);
      }
    } else {
      return res.status(statusCode).json(resBody);
    }
  } catch (error: any) {
    console.error('Mock execution error:', error);
    return res.status(500).json({ error: 'Internal Gateway Error', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[GATEWAY] Mock server running on port ${PORT}`);
});
