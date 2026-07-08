"use client";

import { useEffect, useState } from 'react';
import { getProjects, createProject, deleteProject } from '../../actions';
import Link from 'next/link';
import { useTranslation } from '../../../lib/i18n';

interface Project {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export default function ProjectsPage() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchProjects = async () => {
    try {
      const list = await getProjects();
      setProjects(list as unknown as Project[]);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      await createProject(name, slug);
      setName('');
      setSlug('');
      await fetchProjects();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project? This will delete all endpoints and logs.')) {
      return;
    }
    try {
      await deleteProject(id);
      await fetchProjects();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(val.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 font-mono-custom animate-fade-in">
      {/* Acme 3-Card Metrics Header Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Total Projects */}
        <div className="card-flat p-5 space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-start text-neutral-400 text-xs uppercase">
            <span>{t('totalProjects')}</span>
            <span className="text-[10px] bg-[#1a1a1f] px-1.5 py-0.5 rounded text-white font-bold border border-[#27272a]">
              active
            </span>
          </div>
          <div className="text-3xl font-bold text-white tracking-tight">
            {projects.length}
          </div>
          <div className="text-[10px] text-neutral-500 pt-1">
            Namespaces configured in postgres
          </div>
        </div>

        {/* Card 2: Active Gates */}
        <div className="card-flat p-5 space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-start text-neutral-400 text-xs uppercase">
            <span>{t('activeGates')}</span>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/5 px-1.5 py-0.5 rounded font-bold border border-emerald-500/10">
              online
            </span>
          </div>
          <div className="text-3xl font-bold text-white tracking-tight">
            /mock/*
          </div>
          <div className="text-[10px] text-neutral-500 pt-1">
            Wildcard dynamic route matchers
          </div>
        </div>

        {/* Card 3: Gateway Health */}
        <div className="card-flat p-5 space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-start text-neutral-400 text-xs uppercase">
            <span>{t('gatewayHealth')}</span>
            <span className="text-[10px] text-purple-400 bg-purple-500/5 px-1.5 py-0.5 rounded font-bold border border-purple-500/10">
              100%
            </span>
          </div>
          <div className="text-3xl font-bold text-white tracking-tight">
            WASM VM
          </div>
          <div className="text-[10px] text-neutral-500 pt-1">
            QuickJS workers loaded
          </div>
        </div>
      </div>

      {/* Main Grid: CRUD Action vs Project Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Create Project Form */}
        <div className="card-flat p-6 h-fit bg-[#0c0c0e]/40">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-1">{t('createNamespace')}</h2>
          <p className="text-[10px] text-neutral-500 mb-6">Provision a new isolated sandbox</p>

          {error && (
            <div className="mb-4 p-3 rounded bg-red-950/20 border border-red-500/35 text-red-400 text-[10px]">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-2">{t('namespaceName')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                className="w-full px-3 py-2 rounded bg-[#09090b] border border-[#1f1f23] text-white focus:outline-none focus:border-neutral-500 text-xs font-mono-custom"
                placeholder="Product Service"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-2">{t('namespaceSlug')}</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                className="w-full px-3 py-2 rounded bg-[#09090b] border border-[#1f1f23] text-white focus:outline-none focus:border-neutral-500 text-xs font-mono-custom"
                placeholder="product-service"
              />
              <span className="text-[9px] text-neutral-500 block mt-2 leading-relaxed">
                Gateway matches path:<br />
                <code className="text-purple-400">/mock/{slug || '{slug}'}/*</code>
              </span>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="w-full py-2 px-4 rounded bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition-all"
            >
              {creating ? t('connecting') : t('registerProject')}
            </button>
          </form>
        </div>

        {/* Right Column: Project namespaces list */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 px-1">{t('registeredNamespaces')}</h2>

          {loading ? (
            <div className="text-neutral-500 text-center py-20 text-xs">{t('loadingProjects')}</div>
          ) : projects.length === 0 ? (
            <div className="card-flat p-12 text-center text-neutral-500 text-xs">
              {t('noNamespaces')}
            </div>
          ) : (
            projects.map((proj) => (
              <div
                key={proj.id}
                className="card-flat p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:border-neutral-700 transition-all"
              >
                <div className="space-y-1.5 mb-4 sm:mb-0">
                  <h3 className="text-sm font-bold text-white">{proj.name}</h3>
                  <div className="flex items-center space-x-3 text-[10px] text-neutral-400">
                    <span className="text-neutral-500 font-mono">
                      slug: <code className="text-purple-400">/mock/{proj.slug}</code>
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(proj.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                  <Link
                    href={`/dashboard/projects/${proj.slug}/endpoints`}
                    className="px-3 py-1.5 rounded bg-[#27272a] hover:bg-[#3f3f46] text-white text-[10px] font-semibold border border-[#3f3f46]/40 transition-colors"
                  >
                    {t('manageEndpoints')}
                  </Link>
                  <button
                    onClick={() => handleDelete(proj.id)}
                    className="p-1.5 rounded bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-500/25 transition-all text-xs"
                    title={t('delete')}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
