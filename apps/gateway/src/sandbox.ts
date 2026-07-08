import { Worker } from 'worker_threads';
import path from 'path';

export interface SandboxResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export function executeScriptInSandbox(
  req: any,
  script: string
): Promise<SandboxResponse> {
  return new Promise((resolve, reject) => {
    // Resolve path to the compiled worker JS file in the dist directory
    const workerPath = path.resolve(__dirname, 'sandbox.worker.js');
    const worker = new Worker(workerPath);

    // Enforce safety backup timeout (just in case the worker blocks completely)
    const backupTimeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('Sandbox execution exceeded backup timeout threshold (150ms)'));
    }, 1500);

    worker.postMessage({ req, script });

    worker.on('message', (result: { response?: SandboxResponse; error?: string }) => {
      clearTimeout(backupTimeout);
      worker.terminate();

      if (result.error) {
        reject(new Error(result.error));
      } else if (result.response) {
        resolve(result.response);
      } else {
        reject(new Error('Sandbox worker returned empty response'));
      }
    });

    worker.on('error', (err) => {
      clearTimeout(backupTimeout);
      worker.terminate();
      reject(err);
    });

    worker.on('exit', (code) => {
      clearTimeout(backupTimeout);
      if (code !== 0) {
        reject(new Error(`Sandbox worker stopped with exit code ${code}`));
      }
    });
  });
}
