import { parentPort } from 'worker_threads';
import { getQuickJS } from 'quickjs-emscripten';

if (!parentPort) {
  throw new Error('This file must be run as a worker thread');
}

parentPort.on('message', async (message: { req: any; script: string; secrets?: Record<string, string> }) => {
  const { req, script, secrets = {} } = message;

  let QuickJS: any;
  let runtime: any;
  let context: any;

  try {
    QuickJS = await getQuickJS();
    runtime = QuickJS.newRuntime();
    runtime.setMemoryLimit(8 * 1024 * 1024); // Enforce 8MB WASM memory limit
    context = runtime.newContext();

    // Enforce 100ms execution timeout
    const startTime = Date.now();
    runtime.setInterruptHandler(() => {
      return Date.now() - startTime > 100; // Return true to interrupt execution
    });

    // 1. Bind Cryptographic JWT Signing Host Function
    const jwtSignHandle = context.newFunction('jwtSign', (payloadStrHandle: any, secretStrHandle: any) => {
      const payloadStr = context.getString(payloadStrHandle);
      const secret = context.getString(secretStrHandle);
      const crypto = require('crypto');
      
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payloadEncoded = Buffer.from(payloadStr).toString('base64url');
      const signature = crypto.createHmac('sha256', secret)
        .update(`${header}.${payloadEncoded}`)
        .digest('base64url');
      
      return context.newString(`${header}.${payloadEncoded}.${signature}`);
    });
    context.setProp(context.global, 'jwtSign', jwtSignHandle);
    jwtSignHandle.dispose();

    // 2. Bind Cryptographic JWT Verification Host Function
    const jwtVerifyHandle = context.newFunction('jwtVerify', (tokenHandle: any, secretHandle: any) => {
      const token = context.getString(tokenHandle);
      const secret = context.getString(secretHandle);
      const crypto = require('crypto');
      
      const parts = token.split('.');
      if (parts.length !== 3) return context.newBool(false);
      const [header, payload, signature] = parts;
      
      const computedSignature = crypto.createHmac('sha256', secret)
        .update(`${header}.${payload}`)
        .digest('base64url');
      
      if (signature !== computedSignature) return context.newBool(false);
      
      try {
        const decodedPayload = Buffer.from(payload, 'base64url').toString('utf8');
        return context.newString(decodedPayload);
      } catch (e) {
        return context.newBool(false);
      }
    });
    context.setProp(context.global, 'jwtVerify', jwtVerifyHandle);
    jwtVerifyHandle.dispose();

    // Sandbox environment skeleton setup
    const prefix = `
      let _res = {
        statusCode: 200,
        headers: {},
        body: ""
      };
      const res = {
        status(code) {
          _res.statusCode = Number(code);
          return this;
        },
        setHeader(k, v) {
          _res.headers[String(k)] = String(v);
          return this;
        },
        send(payload) {
          if (payload && typeof payload === 'object') {
            _res.body = JSON.stringify(payload);
            if (!_res.headers['Content-Type'] && !_res.headers['content-type']) {
              _res.headers['Content-Type'] = 'application/json';
            }
          } else {
            _res.body = String(payload);
          }
          return this;
        },
        jwt: {
          sign(payload, secret) {
            return jwtSign(JSON.stringify(payload), String(secret));
          },
          verify(token, secret) {
            const raw = jwtVerify(String(token), String(secret));
            return raw ? JSON.parse(raw) : null;
          }
        }
      };
      const req = ${JSON.stringify(req)};
      req.env = ${JSON.stringify(secrets)};
    `;

    const suffix = `\nJSON.stringify(_res);`;
    const fullScript = prefix + script + suffix;

    const result = context.evalCode(fullScript);

    if (result.error) {
      const errorMsg = context.dump(result.error);
      result.error.dispose();
      parentPort!.postMessage({
        error: `Script Execution Error: ${errorMsg}`,
      });
    } else {
      const jsonRes = context.getString(result.value);
      result.value.dispose();
      
      const parsedRes = JSON.parse(jsonRes);
      parentPort!.postMessage({ response: parsedRes });
    }
  } catch (error: any) {
    parentPort!.postMessage({ error: `Sandbox Crash: ${error.message}` });
  } finally {
    // Explicit WASM memory cleanup to prevent memory leaks
    if (context) context.dispose();
    if (runtime) runtime.dispose();
  }
});
