'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import SignupItemList from '@/components/SignupItemList';
import type { Signup, SignupItem, SignupClaim } from '@/types/database';

type MealTrainSignup = Omit<Signup, 'admin_token'> & {
  recipient_name: string | null;
  dietary_notes: string | null;
  dropoff_location: string | null;
};

export default function MealTrainAdminPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [adminToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return null;
    return new URLSearchParams(hash).get('token');
  });
  const scrubbedRef = useRef(false);
  const [signup, setSignup] = useState<MealTrainSignup | null>(null);
  const [items, setItems] = useState<SignupItem[]>([]);
  const [claims, setClaims] = useState<SignupClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  // Scrub the hash once after mount (Strict Mode-safe)
  useEffect(() => {
    if (scrubbedRef.current) return;
    scrubbedRef.current = true;
    if (typeof window !== 'undefined' && window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
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
      setSignup(data.signup as MealTrainSignup);
      setItems(data.items);
      setClaims(data.claims);
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
    loadAll(adminToken);
  }, [adminToken, loadAll]);

  // Realtime claims updates — reload via admin API to keep email data fresh
  useEffect(() => {
    if (!signup || !adminToken) return;
    const sub = supabase
      .channel(`mealtrain-admin-claims-${signup.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'signup_claims', filter: `signup_id=eq.${signup.id}` },
        () => { loadAll(adminToken); }
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [signup, adminToken, loadAll]);

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
            Meal Train Admin
          </span>
        </div>

        {(signup.recipient_name || signup.dietary_notes || signup.dropoff_location) && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 mb-6 space-y-2">
            {signup.recipient_name && (
              <div>
                <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">For</p>
                <p className="text-sm text-gray-900">{signup.recipient_name}</p>
              </div>
            )}
            {signup.dietary_notes && (
              <div>
                <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Dietary notes</p>
                <p className="text-sm text-gray-900 whitespace-pre-line">{signup.dietary_notes}</p>
              </div>
            )}
            {signup.dropoff_location && (
              <div>
                <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Drop-off</p>
                <p className="text-sm text-gray-900 whitespace-pre-line">{signup.dropoff_location}</p>
              </div>
            )}
          </div>
        )}

        <div className={`grid gap-3 mb-6 ${hasDates ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {hasDates && (
            <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{uniqueDates.size}</p>
              <p className="text-xs text-gray-500">Days</p>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{items.length}</p>
            <p className="text-xs text-gray-500">Slots</p>
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
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/mealtrain/${slug}`}
              readOnly
              className="flex-1 px-3 py-2 rounded-lg border border-indigo-200 text-sm bg-white text-gray-700"
            />
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/mealtrain/${slug}`)}
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
