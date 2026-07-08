"use client";

import { useEffect, useState } from 'react';
import { getEndpoints, deleteEndpoint, getLogs } from '../../../../actions';
import LinkComponent from 'next/link';
import { useParams } from 'next/navigation';

interface Endpoint {
  id: string;
  path: string;
  method: string;
  statusCode: number;
  delay: number;
  script: string | null;
  createdAt: Date;
}

export default function EndpointsPage() {
  const params = useParams();
  const projectSlug = params.projectSlug as string;

  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [totalLogs, setTotalLogs] = useState(0);

  const fetchEndpoints = async () => {
    try {
      const list = await getEndpoints(projectSlug);
      setEndpoints(list as unknown as Endpoint[]);

      // Fetch logs count for metrics
      const logList = await getLogs(projectSlug);
      setTotalLogs(logList.length);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEndpoints();
  }, [projectSlug]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this endpoint?')) return;
    try {
      await deleteEndpoint(id);
      await fetchEndpoints();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCopyLink = (path: string, id: string) => {
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    const url = `${window.location.origin}/mock/${projectSlug}/${cleanPath}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
      case 'POST':
        return 'text-blue-400 border-blue-500/20 bg-blue-500/5';
      case 'PUT':
        return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
      case 'DELETE':
        return 'text-red-400 border-red-500/20 bg-red-500/5';
      default:
        return 'text-neutral-400 border-neutral-800 bg-neutral-800/10';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-mono-custom animate-fade-in">
      {/* Page Navigation & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[10px] text-neutral-500 uppercase mb-1">
            <LinkComponent href="/dashboard/projects" className="hover:text-white">Projects</LinkComponent>
            <span>/</span>
            <span className="text-white">{projectSlug}</span>
          </div>
          <h1 className="text-xl font-bold text-white uppercase tracking-wider">Endpoints Config</h1>
        </div>

        <div className="flex items-center space-x-3">
          <LinkComponent
            href={`/dashboard/projects/${projectSlug}/logs`}
            className="px-3 py-1.5 rounded bg-[#121214] border border-[#1f1f23] hover:bg-[#1a1a1f] text-neutral-300 hover:text-white text-xs transition-colors"
          >
            📋 Log Monitor
          </LinkComponent>
          <LinkComponent
            href={`/dashboard/projects/${projectSlug}/endpoints/new`}
            className="px-3 py-1.5 rounded bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition-colors"
          >
            ➕ New Mock Endpoint
          </LinkComponent>
        </div>
      </div>

      {/* Acme 3-Card Metrics Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="card-flat p-5 space-y-1 relative">
          <span className="text-neutral-400 text-[10px] uppercase block">Mock Routes</span>
          <div className="text-2xl font-bold text-white">{endpoints.length}</div>
          <span className="text-[9px] text-neutral-500 block">Total interceptors registered</span>
        </div>

        <div className="card-flat p-5 space-y-1 relative">
          <span className="text-neutral-400 text-[10px] uppercase block">Total Queries</span>
          <div className="text-2xl font-bold text-white">{totalLogs}</div>
          <span className="text-[9px] text-neutral-500 block">Requests tracked in db logs</span>
        </div>

        <div className="card-flat p-5 space-y-1 relative">
          <span className="text-neutral-400 text-[10px] uppercase block">WASM Sandbox</span>
          <div className="text-2xl font-bold text-white">
            {endpoints.filter((e) => e.script).length} Active
          </div>
          <span className="text-[9px] text-neutral-500 block">Endpoints utilizing JS engines</span>
        </div>
      </div>

      {/* Table Section */}
      {loading ? (
        <div className="text-neutral-500 text-center py-20 text-xs">Loading endpoints...</div>
      ) : endpoints.length === 0 ? (
        <div className="card-flat p-12 text-center text-neutral-500 text-xs">
          No mock endpoints configured for this namespace.
        </div>
      ) : (
        <div className="card-flat overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1f1f23] bg-[#0c0c0e]/60 text-neutral-400 text-[10px] font-bold uppercase tracking-wider">
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Path Pattern</th>
                  <th className="px-5 py-3">HTTP Status</th>
                  <th className="px-5 py-3">Delay</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f23]/60 text-xs">
                {endpoints.map((ep) => (
                  <tr key={ep.id} className="hover:bg-[#121214]/50 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${getMethodBadgeClass(ep.method)}`}>
                        {ep.method}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-neutral-200">
                      <div className="flex items-center space-x-2">
                        <span className="truncate max-w-xs">{ep.path}</span>
                        <button
                          onClick={() => handleCopyLink(ep.path, ep.id)}
                          className="text-neutral-500 hover:text-white transition-colors"
                          title="Copy Full URL"
                        >
                          {copiedId === ep.id ? (
                            <span className="text-[8px] text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 px-1 rounded font-sans">copied!</span>
                          ) : (
                            <span className="text-[10px]">📋</span>
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-neutral-300">
                      <span className="font-semibold">{ep.statusCode}</span>
                    </td>
                    <td className="px-5 py-3 text-neutral-500 whitespace-nowrap">
                      {ep.delay > 0 ? `${ep.delay}ms` : '0ms'}
                    </td>
                    <td className="px-5 py-3">
                      {ep.script ? (
                        <span className="text-purple-400 font-semibold text-[10px] uppercase">⚡ JS Script</span>
                      ) : (
                        <span className="text-neutral-500 text-[10px] uppercase">static</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <div className="flex justify-end items-center space-x-2">
                        <LinkComponent
                          href={`/dashboard/projects/${projectSlug}/endpoints/${ep.id}`}
                          className="px-2.5 py-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-white text-[10px] border border-[#3f3f46]/40 transition-colors"
                        >
                          Edit
                        </LinkComponent>
                        <button
                          onClick={() => handleDelete(ep.id)}
                          className="p-1 rounded bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-500/25 transition-all text-xs"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
