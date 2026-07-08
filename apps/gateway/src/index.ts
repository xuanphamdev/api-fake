import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { prisma } from 'db';
import { matchRoute } from './matcher.js';
import { startLogPruner } from './cron.js';
import { executeScriptInSandbox } from './sandbox.js';
import { loggerBuffer } from './logger-buffer.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
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
    // 1. Fetch project and its endpoints
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      include: { endpoints: true },
    });

    if (!project) {
      return res.status(404).json({ error: `Mock Project '${projectSlug}' not found` });
    }

    // 2. Match requested path against project endpoints
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

    // 3. Execute Script inside Sandbox if defined
    if (endpoint.script) {
      const reqContext = {
        method,
        headers: req.headers,
        query: req.query,
        body: req.body,
        params,
      };

      try {
        const sandboxedRes = await executeScriptInSandbox(reqContext, endpoint.script);
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
