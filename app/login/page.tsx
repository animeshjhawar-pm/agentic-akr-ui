'use client';

// app/login/page.tsx
//
// Minimal login page. POSTs to /api/login with the shared secret.
// On success, redirects to the "next" query param (default "/").
// The raw secret is sent to /api/login and is never stored client-side.
// useSearchParams() is wrapped in Suspense as required by Next.js App Router.

import React, { Suspense, useRef, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeNextPath } from '@/lib/auth/safe-next-path';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  // Validate the next param -- only same-origin paths (starts with '/', not '//') are
  // accepted. Anything else (protocol-relative, absolute URL, empty) falls back to '/'.
  const safeNext = safeNextPath(params.get('next'));

  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const secret = inputRef.current?.value ?? '';

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });

      if (res.ok) {
        router.replace(safeNext);
      } else {
        setError('Incorrect password. Please try again.');
        if (inputRef.current) {
          inputRef.current.value = '';
          inputRef.current.focus();
        }
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} autoComplete="off">
      <div className="mb-4">
        <label
          htmlFor="secret"
          className="block text-xs font-medium text-on-surface-muted mb-1.5"
        >
          Password
        </label>
        <input
          id="secret"
          ref={inputRef}
          type="password"
          autoComplete="current-password"
          required
          disabled={loading}
          className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
          placeholder="Enter access password"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md bg-danger-surface px-3 py-2 text-xs text-danger mb-4"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-h-[40px]"
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl bg-surface border border-border p-8 shadow-sm">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <img src="/gush_logo.svg" width="24" height="24" alt="Gushwork" />
            <span className="text-base font-semibold text-on-surface">Agentic AKR</span>
          </div>

          <h1 className="text-sm font-semibold text-on-surface mb-1">Sign in</h1>
          <p className="text-xs text-on-surface-muted mb-6">
            Enter the shared access password to continue.
          </p>

          <Suspense fallback={<div className="h-24 animate-pulse bg-surface-muted rounded-md" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
