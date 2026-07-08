import { parentPort } from 'worker_threads';
import { getQuickJS } from 'quickjs-emscripten';

if (!parentPort) {
  throw new Error('This file must be run as a worker thread');
}

parentPort.on('message', async (message: { req: any; script: string }) => {
  const { req, script } = message;

  let QuickJS;
  let runtime;
  let context;

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
        }
      };
      const req = ${JSON.stringify(req)};
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
