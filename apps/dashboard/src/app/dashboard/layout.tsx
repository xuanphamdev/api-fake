"use client";

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      const res = await fetch('/dashboard/api/auth/logout', {
        method: 'POST',
      });
      if (res.ok) {
        router.push('/dashboard/login');
        router.refresh();
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-neutral-200 overflow-hidden font-mono-custom">
      {/* Sidebar (Acme style) */}
      <aside className="w-64 bg-[#0c0c0e] border-r border-[#1f1f23] flex flex-col justify-between p-5 z-20">
        <div>
          {/* Header Workspace */}
          <div className="flex items-center space-x-2.5 mb-6 px-1">
            <div className="h-4 w-4 rounded-full border border-neutral-400 flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-neutral-200" />
            </div>
            <span className="font-semibold text-xs tracking-tight text-white uppercase">Antigravity Inc.</span>
          </div>

          {/* Quick Actions (Acme style) */}
          <div className="flex items-center space-x-2 mb-8">
            <Link
              href="/dashboard/projects"
              className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded bg-[#27272a] hover:bg-[#3f3f46] text-white text-xs font-semibold border border-[#3f3f46]/30 transition-all"
            >
              <span>+</span>
              <span>New Project</span>
            </Link>
            <Link
              href="/dashboard/projects"
              className="w-8 h-8 flex items-center justify-center rounded border border-[#1f1f23] hover:bg-[#1a1a1f] text-neutral-400 hover:text-white transition-all text-xs"
              title="Global Console"
            >
              ⚙️
            </Link>
          </div>

          {/* Menu Section 1 */}
          <nav className="space-y-1 mb-8">
            <Link
              href="/dashboard/projects"
              className={`flex items-center space-x-3 px-3 py-2 rounded text-xs transition-all ${
                pathname.startsWith('/dashboard/projects') && !pathname.includes('/logs')
                  ? 'bg-[#18181b] text-white border border-[#27272a]'
                  : 'text-neutral-400 hover:bg-[#18181b]/50 hover:text-neutral-200 border border-transparent'
              }`}
            >
              <span>📂</span>
              <span>Projects Namespaces</span>
            </Link>
          </nav>

          {/* Menu Section 2 (Documents Header style) */}
          <div>
            <span className="px-3 text-[10px] uppercase font-bold text-neutral-500 tracking-wider block mb-2">Systems Log</span>
            <nav className="space-y-1">
              <Link
                href="/dashboard/projects" // fallback or direct logs
                className={`flex items-center space-x-3 px-3 py-2 rounded text-xs transition-all text-neutral-400 hover:bg-[#18181b]/50 hover:text-neutral-200 border border-transparent`}
              >
                <span>📋</span>
                <span>Realtime Logger</span>
              </Link>
            </nav>
          </div>
        </div>

        {/* Footer Account / Logout */}
        <div className="pt-4 border-t border-[#1f1f23] space-y-4">
          <div className="flex items-center space-x-2.5 px-1.5">
            <div className="h-6 w-6 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[10px] font-bold text-neutral-400">
              D
            </div>
            <div className="truncate">
              <span className="text-[10px] font-bold text-neutral-300 block truncate">Developer Session</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-2 px-3 py-2 rounded text-xs text-neutral-500 hover:text-red-400 hover:bg-red-500/5 transition-all text-left"
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main View Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#09090b]">
        {/* Top Header bar with exact Sidebar Toggle style */}
        <header className="h-12 border-b border-[#1f1f23] bg-[#0c0c0e]/30 backdrop-blur-md flex items-center px-6 space-x-3 z-10">
          {/* Sidebar Toggle icon */}
          <button className="text-neutral-400 hover:text-white transition-colors" title="Toggle Sidebar">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <span className="text-neutral-600">|</span>
          
          <span className="text-xs text-neutral-300 font-semibold uppercase">API Engine Console</span>
        </header>

        {/* View content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 bg-flat-grid">
          {children}
        </main>
      </div>
    </div>
  );
}
