"use client";

import { useEffect, useState } from 'react';
import { getLogs } from '../../../../actions';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface ApiLog {
  id: string;
  method: string;
  path: string;
  reqHeaders: any;
  reqQuery: any;
  reqBody: any;
  resHeaders: any;
  resStatus: number;
  resBody: string | null;
  duration: number;
  timestamp: Date;
  endpoint: {
    path: string;
  };
}

export default function LogsPage() {
  const params = useParams();
  const projectSlug = params.projectSlug as string;

  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null);

  const fetchLogs = async () => {
    try {
      const data = await getLogs(projectSlug);
      setLogs(data as unknown as ApiLog[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [projectSlug]);

  const getStatusClass = (status: number) => {
    if (status >= 200 && status < 300) return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
    if (status >= 300 && status < 400) return 'text-blue-400 border-blue-500/20 bg-blue-500/5';
    if (status >= 400 && status < 500) return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
    return 'text-red-400 border-red-500/20 bg-red-500/5';
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
      {/* Header Breadcrumbs & Status */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[10px] text-neutral-500 uppercase mb-1">
            <Link href="/dashboard/projects" className="hover:text-white">Projects</Link>
            <span>/</span>
            <Link href={`/dashboard/projects/${projectSlug}/endpoints`} className="hover:text-white">{projectSlug}</Link>
            <span>/</span>
            <span className="text-white">Request Logs</span>
          </div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold text-white uppercase tracking-wider">Gateway Logs</h1>
            <span className="text-[9px] text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded font-bold uppercase animate-pulse">
              Live Monitor
            </span>
          </div>
        </div>

        <div>
          <button
            onClick={fetchLogs}
            className="px-3 py-1.5 rounded bg-[#121214] border border-[#1f1f23] hover:bg-[#1a1a1f] text-neutral-300 hover:text-white text-xs transition-colors"
          >
            🔄 Sync Logger
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-neutral-500 text-center py-20 text-xs">Loading logs...</div>
      ) : logs.length === 0 ? (
        <div className="card-flat p-12 text-center text-neutral-500 text-xs">
          No gateway requests logged for this namespace yet.
        </div>
      ) : (
        <div className="card-flat overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1f1f23] bg-[#0c0c0e]/60 text-neutral-400 text-[10px] font-bold uppercase tracking-wider">
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Matched Path</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Duration</th>
                  <th className="px-5 py-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f23]/60 text-xs">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#121214]/50 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-neutral-500 text-[10px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${getMethodBadgeClass(log.method)}`}>
                        {log.method}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-neutral-200 truncate max-w-xs" title={log.path}>
                      {log.path}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${getStatusClass(log.resStatus)}`}>
                        {log.resStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-neutral-500 text-[10px]">
                      {log.duration}ms
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-white text-[10px] border border-[#3f3f46]/40 transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Log Detail Modal (Acme dark terminal style) */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-4xl card-flat p-6 overflow-hidden flex flex-col max-h-[85vh] bg-[#09090b] border border-[#1f1f23]">
            <div className="flex justify-between items-center pb-4 border-b border-[#1f1f23] mb-6">
              <div>
                <span className="text-[9px] text-neutral-500 uppercase tracking-widest block font-bold">Request Inspector</span>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2 mt-1">
                  <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${getMethodBadgeClass(selectedLog.method)}`}>{selectedLog.method}</span>
                  <span className="text-xs text-neutral-300 font-mono">{selectedLog.path}</span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-neutral-400 hover:text-white bg-[#121214] border border-[#1f1f23] w-6 h-6 rounded flex items-center justify-center transition-colors text-xs"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 text-xs font-mono pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-neutral-400 mb-2">Request Headers</h4>
                  <pre className="p-4 rounded bg-[#0c0c0e] border border-[#1f1f23] text-purple-400 overflow-x-auto max-h-48 leading-relaxed">
                    {JSON.stringify(selectedLog.reqHeaders, null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-neutral-400 mb-2">Query Parameters</h4>
                  <pre className="p-4 rounded bg-[#0c0c0e] border border-[#1f1f23] text-purple-400 overflow-x-auto max-h-48 leading-relaxed">
                    {JSON.stringify(selectedLog.reqQuery, null, 2)}
                  </pre>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] uppercase font-bold text-neutral-400 mb-2">Request Body</h4>
                <pre className="p-4 rounded bg-[#0c0c0e] border border-[#1f1f23] text-neutral-300 overflow-x-auto max-h-48 leading-relaxed">
                  {selectedLog.reqBody
                    ? typeof selectedLog.reqBody === 'object'
                      ? JSON.stringify(selectedLog.reqBody, null, 2)
                      : selectedLog.reqBody
                    : 'Empty'}
                </pre>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-neutral-400 mb-2">Response Headers</h4>
                  <pre className="p-4 rounded bg-[#0c0c0e] border border-[#1f1f23] text-emerald-400 overflow-x-auto max-h-48 leading-relaxed">
                    {JSON.stringify(selectedLog.resHeaders, null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-neutral-400 mb-2">Gateway Telemetry</h4>
                  <div className="p-4 rounded bg-[#0c0c0e] border border-[#1f1f23] text-neutral-400 space-y-2">
                    <p className="flex justify-between">
                      <span>Status Code:</span>
                      <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${getStatusClass(selectedLog.resStatus)}`}>{selectedLog.resStatus}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Latency:</span>
                      <span className="text-white font-bold">{selectedLog.duration}ms</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Timestamp:</span>
                      <span className="text-neutral-500 font-mono text-[9px]">{new Date(selectedLog.timestamp).toISOString()}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] uppercase font-bold text-neutral-400 mb-2">Response Body</h4>
                <pre className="p-4 rounded bg-[#0c0c0e] border border-[#1f1f23] text-emerald-300 overflow-x-auto max-h-48 leading-relaxed">
                  {selectedLog.resBody || 'Empty'}
                </pre>
              </div>
            </div>

            <div className="pt-4 border-t border-[#1f1f23] mt-6 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded bg-[#121214] hover:bg-[#1a1a1f] border border-[#1f1f23] text-white font-semibold transition-colors text-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
