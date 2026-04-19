'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import SignupItemList from '@/components/SignupItemList';
import type { Signup, SignupItem, SignupClaim } from '@/types/database';

function readTokenFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  return new URLSearchParams(hash).get('token');
}

function scrubHash() {
  if (typeof window === 'undefined') return;
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

export default function SignupAdminPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [signup, setSignup] = useState<Signup | null>(null);
  const [items, setItems] = useState<SignupItem[]>([]);
  const [claims, setClaims] = useState<SignupClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    setAdminToken(readTokenFromHash());
    scrubHash();
  }, []);

  const loadAll = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/signups/admin', {
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
      setSignup(data.signup);
      setItems(data.items);
      setClaims(data.claims);
      setLoading(false);
    } catch {
      setAuthError('Failed to load');
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (adminToken === null) return;
    if (!adminToken) {
      setAuthError('Missing admin token');
      setLoading(false);
      return;
    }
    loadAll(adminToken);
  }, [adminToken, loadAll]);

  // Realtime claims updates — narrow column list
  useEffect(() => {
    if (!signup) return;
    const sub = supabase
      .channel(`admin-claims-${signup.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'signup_claims', filter: `signup_id=eq.${signup.id}` },
        async () => {
          const { data } = await supabase
            .from('signup_claims')
            .select('id, item_id, signup_id, participant_name, created_at')
            .eq('signup_id', signup.id);
          if (data) setClaims(data as SignupClaim[]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [signup]);

  async function handleAdminRemove(claimId: string) {
    if (!signup || !adminToken) return;
    setRemoving(claimId);
    try {
      const res = await fetch('/api/signups/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_claim', slug, adminToken, claimId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove');
      }
      // Reload via API to keep emails populated
      await loadAll(adminToken);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove claim');
    } finally {
      setRemoving(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  if (authError || !signup) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{authError || 'Not found'}</p>
          <a href="/" className="text-indigo-500 hover:text-indigo-600 font-medium">Go Home</a>
        </div>
      </main>
    );
  }

  const totalSpots = items.reduce((sum, item) => sum + item.capacity, 0);
  const filledSpots = claims.length;
  const uniqueDates = new Set(items.filter((i) => i.date).map((i) => i.date));
  const hasDates = uniqueDates.size > 0;

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <a href="/" className="text-sm text-gray-400 hover:text-indigo-500 transition-colors">Group Tools</a>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{signup.name}</h1>
          <span className="inline-block mt-1 text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
            Admin View
          </span>
        </div>

        <div className={`grid gap-3 mb-6 ${hasDates ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {hasDates && (
            <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{uniqueDates.size}</p>
              <p className="text-xs text-gray-500">Days</p>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{items.length}</p>
            <p className="text-xs text-gray-500">{signup.type === 'potluck' ? 'Items' : 'Slots'}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-2xl font-bold text-indigo-600">{filledSpots}</p>
            <p className="text-xs text-gray-500">Claimed</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{totalSpots - filledSpots}</p>
            <p className="text-xs text-gray-500">Open</p>
          </div>
        </div>

        <div className="bg-indigo-50 rounded-xl p-4 mb-6">
          <p className="text-sm text-indigo-700 font-medium mb-2">Participant Link</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/signup/${slug}`}
              readOnly
              className="flex-1 px-3 py-2 rounded-lg border border-indigo-200 text-sm bg-white text-gray-700"
            />
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/signup/${slug}`)}
              className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Copy
            </button>
          </div>
        </div>

        <SignupItemList
          items={items}
          claims={claims}
          sessionToken={null}
          participantName=""
          onClaim={() => {}}
          onUnclaim={() => {}}
          claiming={removing}
          isAdmin
          onAdminRemove={handleAdminRemove}
        />
      </div>
    </main>
  );
}
