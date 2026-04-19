'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import type { Poll, PollOption, PollVote } from '@/types/database';

type AdminPoll = Omit<Poll, 'admin_token'>;

function readTokenFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  return new URLSearchParams(hash).get('token');
}

export default function PollAdminPage() {
  const params = useParams();
  const slug = params.slug as string;

  // Lazy-init from the hash so Strict Mode's double-render can't race the scrub.
  const [adminToken] = useState<string | null>(() => readTokenFromHash());
  const scrubbedRef = useRef(false);
  const [poll, setPoll] = useState<AdminPoll | null>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [votes, setVotes] = useState<PollVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Scrub the hash once after mount (Strict Mode-safe)
  useEffect(() => {
    if (scrubbedRef.current) return;
    scrubbedRef.current = true;
    if (typeof window !== 'undefined' && window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  const load = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/polls/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load', slug, adminToken: token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAuthError(data.error || 'Not authorized');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setPoll(data.poll as AdminPoll);
      setOptions(data.options);
      setVotes(data.votes);
      setLoading(false);
    } catch {
      setAuthError('Failed to load');
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!adminToken) {
      setAuthError('Missing admin token');
      setLoading(false);
      return;
    }
    load(adminToken);
  }, [adminToken, load]);

  async function setClosed(closed: boolean) {
    if (!adminToken) return;
    setBusy(true);
    try {
      await fetch('/api/polls/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_closed', slug, adminToken, closed }),
      });
      await load(adminToken);
    } finally {
      setBusy(false);
    }
  }

  async function removeVote(voteId: string) {
    if (!adminToken) return;
    if (!confirm('Remove this vote?')) return;
    setBusy(true);
    try {
      await fetch('/api/polls/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_vote', slug, adminToken, voteId }),
      });
      await load(adminToken);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (<main className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading...</p></main>);
  }
  if (authError || !poll) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Not Authorized</h1>
          <p className="text-gray-500">{authError || 'Invalid or missing admin token.'}</p>
        </div>
      </main>
    );
  }

  const optionMap = new Map(options.map((o) => [o.id, o]));

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <a href="/" className="text-sm text-gray-400 hover:text-indigo-500 transition-colors">Group Tools</a>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{poll.title}</h1>
          <span className="inline-block mt-1 text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">Admin View</span>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Status</p>
            <p className="text-xs text-gray-500">{poll.closed ? 'Closed — votes locked' : 'Open — voters can submit and change votes'}</p>
          </div>
          <button onClick={() => setClosed(!poll.closed)} disabled={busy}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              poll.closed ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
            {poll.closed ? 'Reopen' : 'Close'}
          </button>
        </div>

        <div className="bg-indigo-50 rounded-xl p-4 mb-6">
          <p className="text-sm text-indigo-700 font-medium mb-2">Participant Link</p>
          <div className="flex gap-2">
            <input type="text" readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/poll/${slug}`}
              className="flex-1 px-3 py-2 rounded-lg border border-indigo-200 text-sm bg-white text-gray-700" />
            <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/poll/${slug}`)}
              className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors">
              Copy
            </button>
          </div>
        </div>

        <h2 className="text-sm font-semibold text-gray-700 mb-2">Votes ({votes.length})</h2>
        {votes.length === 0 && (<p className="text-center text-gray-400 py-8">No votes yet.</p>)}
        <div className="space-y-2">
          {votes.map((v) => {
            const opt = optionMap.get(v.option_id);
            return (
              <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{v.voter_name}</p>
                  <p className="text-xs text-gray-500 truncate">→ {opt?.label || 'Unknown option'}</p>
                </div>
                <button onClick={() => removeVote(v.id)} disabled={busy}
                  className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50">
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
