"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/dashboard/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard/login');
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#09090b] bg-flat-grid px-4 overflow-hidden font-mono-custom">
      <div className="w-full max-w-sm card-flat bg-[#0c0c0e] p-8 z-10 border border-[#1f1f23] animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex h-8 w-8 rounded-full border border-neutral-400 items-center justify-center mb-4">
            <div className="h-1.5 w-1.5 rounded-full bg-neutral-200" />
          </div>
          <h1 className="text-sm font-bold uppercase tracking-wider text-white mb-1">Create Account</h1>
          <p className="text-[10px] text-neutral-500 uppercase">Register developer node</p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded bg-red-950/20 border border-red-500/25 text-red-400 text-[10px]">
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="mb-5 p-3 rounded bg-green-950/20 border border-green-500/25 text-green-400 text-[10px]">
            ✓ Node registered. Redirecting...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded bg-[#09090b] border border-[#1f1f23] text-white placeholder-neutral-700 focus:outline-none focus:border-neutral-500 text-xs font-mono-custom"
              placeholder="developer@acme.inc"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded bg-[#09090b] border border-[#1f1f23] text-white placeholder-neutral-700 focus:outline-none focus:border-neutral-500 text-xs font-mono-custom"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-2">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded bg-[#09090b] border border-[#1f1f23] text-white placeholder-neutral-700 focus:outline-none focus:border-neutral-500 text-xs font-mono-custom"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full py-2.5 px-4 rounded bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition-all uppercase tracking-wider"
          >
            {loading ? 'registering...' : 'Register'}
          </button>
        </form>

        <p className="mt-8 text-center text-[10px] text-neutral-500 uppercase">
          Already have an account?{' '}
          <Link href="/login" className="text-white hover:underline font-semibold">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
