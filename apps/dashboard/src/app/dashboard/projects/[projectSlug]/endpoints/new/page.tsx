"use client";

import { useEffect, useState } from 'react';
import { getProjects, createEndpoint } from '../../../../../actions';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewEndpointPage() {
  const params = useParams();
  const router = useRouter();
  const projectSlug = params.projectSlug as string;

  const [projectId, setProjectId] = useState('');
  const [path, setPath] = useState('');
  const [method, setMethod] = useState('GET');
  const [statusCode, setStatusCode] = useState(200);
  const [headers, setHeaders] = useState('{\n  "Content-Type": "application/json"\n}');
  const [responseBody, setResponseBody] = useState('{\n  "message": "success"\n}');
  const [delay, setDelay] = useState(0);
  const [script, setScript] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchProject() {
      const list = await getProjects();
      const proj = list.find((p) => p.slug === projectSlug);
      if (proj) {
        setProjectId(proj.id);
      }
    }
    fetchProject();
  }, [projectSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!projectId) {
        throw new Error('Project context not resolved');
      }

      await createEndpoint(projectId, {
        path,
        method,
        headers,
        statusCode: Number(statusCode),
        responseBody,
        delay: Number(delay),
        script,
      });

      router.push(`/dashboard/projects/${projectSlug}/endpoints`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header breadcrumbs */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center space-x-2 text-xs text-zinc-500 mb-1.5 font-medium">
            <Link href="/dashboard/projects" className="hover:text-zinc-300 transition-colors">Projects</Link>
            <span>/</span>
            <Link href={`/dashboard/projects/${projectSlug}/endpoints`} className="hover:text-zinc-300 transition-colors">{projectSlug}</Link>
            <span>/</span>
            <span className="text-zinc-300 font-semibold">New Mock Endpoint</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Create Mock API</h1>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT COLUMN: Endpoint Routing Settings */}
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-6 border border-zinc-800/80 bg-zinc-900/20">
            <h2 className="text-md font-semibold text-white">Route Interceptor Settings</h2>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-2">HTTP Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-purple-500 text-sm font-semibold"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-2">Path Pattern</label>
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-700 focus:outline-none focus:border-purple-500 text-sm font-mono"
                  placeholder="/v1/users/:id"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-2">Response Status Code</label>
                <input
                  type="number"
                  value={statusCode}
                  onChange={(e) => setStatusCode(Number(e.target.value))}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-700 focus:outline-none focus:border-purple-500 text-sm font-semibold"
                  placeholder="200"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-2">Network Latency Delay (ms)</label>
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    min="0"
                    max="2000"
                    step="50"
                    value={delay}
                    onChange={(e) => setDelay(Number(e.target.value))}
                    className="flex-1 h-1.5 rounded-lg bg-zinc-800 cursor-pointer accent-purple-600 my-3"
                  />
                  <span className="text-xs font-mono font-bold text-purple-400 whitespace-nowrap bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20">{delay}ms</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic scripting box */}
          <div className="glass-panel rounded-2xl p-6 space-y-4 border border-zinc-800/80 bg-zinc-900/20">
            <div className="flex justify-between items-center">
              <h2 className="text-md font-semibold text-white">⚡ JS Sandbox Script (Dynamic)</h2>
              <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">WASM isolated</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Exposed objects: <code className="text-purple-400">req</code> (headers, query, body, params) and <code className="text-purple-400">res</code> (status(code), setHeader(k, v), send(data)). Leaves static responses ignored if written.
            </p>
            <div>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={10}
                className="w-full p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-purple-300 font-mono text-xs focus:outline-none focus:border-purple-500 leading-relaxed shadow-inner"
                placeholder={`// Example Dynamic script:\nif (req.body.role === "admin") {\n  res.status(200).send({ welcome: "admin" });\n} else {\n  res.status(403).send({ error: "Access denied" });\n}`}
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Static Response Settings */}
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-6 border border-zinc-800/80 bg-zinc-900/20">
            <h2 className="text-md font-semibold text-white">Response Payload (Static fallback)</h2>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-2">Custom Headers (JSON)</label>
              <textarea
                value={headers}
                onChange={(e) => setHeaders(e.target.value)}
                rows={4}
                className="w-full p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-xs focus:outline-none focus:border-purple-500 shadow-inner"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-2">Response Body (JSON or String)</label>
              <textarea
                value={responseBody}
                onChange={(e) => setResponseBody(e.target.value)}
                rows={8}
                className="w-full p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-xs focus:outline-none focus:border-purple-500 shadow-inner"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end items-center space-x-4 pt-4">
            <Link
              href={`/dashboard/projects/${projectSlug}/endpoints`}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white font-semibold transition-all text-sm"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-all btn-glow text-sm"
            >
              {loading ? 'Creating...' : 'Create Mock API'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
