'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import SignupItemList from '@/components/SignupItemList';
import type { Signup, SignupItem, SignupClaim } from '@/types/database';
import { generateToken } from '@/lib/utils';

export default function SignupParticipantPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [signup, setSignup] = useState<Omit<Signup, 'admin_token'> | null>(null);
  const [items, setItems] = useState<SignupItem[]>([]);
  const [claims, setClaims] = useState<SignupClaim[]>([]);
  const [participantName, setParticipantName] = useState('');
  const [participantEmail, setParticipantEmail] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nameSubmitted, setNameSubmitted] = useState(false);

  const loadData = useCallback(async () => {
    const { data: signupData, error: signupError } = await supabase
      .from('signups')
      .select('id, slug, name, description, type, organizer_email, recipient_name, dietary_notes, dropoff_location, created_at')
      .eq('slug', slug)
      .single();

    if (signupError || !signupData) {
      setError('Sign-up not found');
      setLoading(false);
      return;
    }

    setSignup(signupData);

    const { data: itemsData } = await supabase
      .from('signup_items')
      .select('*')
      .eq('signup_id', signupData.id)
      .order('sort_order');

    setItems(itemsData || []);

    const { data: claimsData } = await supabase
      .from('signup_claims')
      .select('*')
      .eq('signup_id', signupData.id);

    setClaims(claimsData || []);
    setLoading(false);
  }, [slug]);

  // Initialize session token
  useEffect(() => {
    if (!signup) return;
    const storageKey = `gm_signup_session_${signup.id}`;
    let token = localStorage.getItem(storageKey);
    if (!token) {
      token = generateToken();
      localStorage.setItem(storageKey, token);
    }
    setSessionToken(token);

    // Check if this session has previously claimed anything (auto-fill name)
    const existingClaim = claims.find((c) => c.session_token === token);
    if (existingClaim) {
      setParticipantName(existingClaim.participant_name);
      if (existingClaim.participant_email) {
        setParticipantEmail(existingClaim.participant_email);
      }
      setNameSubmitted(true);
    }
  }, [signup, claims]);

  // Load initial data
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time subscriptions
  useEffect(() => {
    if (!signup) return;

    const claimsSub = supabase
      .channel(`signup-claims-${signup.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'signup_claims', filter: `signup_id=eq.${signup.id}` },
        () => {
          // Reload claims on any change
          supabase
            .from('signup_claims')
            .select('*')
            .eq('signup_id', signup.id)
            .then(({ data }) => {
              if (data) setClaims(data);
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(claimsSub);
    };
  }, [signup]);

  async function handleClaim(itemId: string) {
    if (!sessionToken || !participantName.trim() || !signup) return;
    setClaiming(itemId);

    try {
      const res = await fetch('/api/signups/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'claim',
          itemId,
          signupId: signup.id,
          participantName: participantName.trim(),
          participantEmail: participantEmail.trim() || null,
          sessionToken,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sign up');
      }

      // Reload claims
      const { data: claimsData } = await supabase
        .from('signup_claims')
        .select('*')
        .eq('signup_id', signup.id);
      setClaims(claimsData || []);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setClaiming(null);
    }
  }

  async function handleUnclaim(claimId: string) {
    if (!sessionToken) return;
    setClaiming('unclaiming');

    try {
      const res = await fetch('/api/signups/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unclaim',
          claimId,
          sessionToken,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove');
      }

      // Reload claims
      const { data: claimsData } = await supabase
        .from('signup_claims')
        .select('*')
        .eq('signup_id', signup!.id);
      setClaims(claimsData || []);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setClaiming(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  if (error || !signup) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{error || 'Not found'}</p>
          <a href="/" className="text-indigo-500 hover:text-indigo-600 font-medium">Go Home</a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <a href="/" className="text-sm text-gray-400 hover:text-indigo-500 transition-colors">Group Tools</a>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{signup.name}</h1>
          {signup.description && (
            <p className="text-gray-500 mt-1">{signup.description}</p>
          )}
          <span className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
            {signup.type === 'potluck' ? 'Potluck' : 'Sign-Up Sheet'}
          </span>
          {(() => {
            const uniqueDates = new Set(items.filter((i) => i.date).map((i) => i.date));
            return uniqueDates.size > 0 ? (
              <p className="text-xs text-gray-400 mt-1">
                {uniqueDates.size} day{uniqueDates.size !== 1 ? 's' : ''}
              </p>
            ) : null;
          })()}
        </div>

        {/* Name input */}
        {!nameSubmitted ? (
          <div className="mb-6 space-y-3">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Your Name *
              </label>
              <input
                id="name"
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
                maxLength={50}
              />
            </div>
            <div>
              <label htmlFor="pemail" className="block text-sm font-medium text-gray-700 mb-1">
                Your Email (optional)
              </label>
              <input
                id="pemail"
                type="email"
                value={participantEmail}
                onChange={(e) => setParticipantEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
              />
            </div>
            <button
              onClick={() => {
                if (participantName.trim()) setNameSubmitted(true);
              }}
              disabled={!participantName.trim()}
              className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="mb-4 flex items-center justify-between bg-indigo-50 rounded-xl px-4 py-3">
            <span className="text-sm text-indigo-700">
              Signed in as <strong>{participantName}</strong>
            </span>
            <button
              onClick={() => setNameSubmitted(false)}
              className="text-xs text-indigo-500 hover:text-indigo-600 font-medium"
            >
              Change
            </button>
          </div>
        )}

        {/* Items list */}
        <SignupItemList
          items={items}
          claims={claims}
          sessionToken={sessionToken}
          participantName={participantName}
          onClaim={handleClaim}
          onUnclaim={handleUnclaim}
          claiming={claiming}
        />

        <p className="text-center text-xs text-gray-400 mt-8">
          Powered by Group Tools
        </p>
      </div>
    </main>
  );
}
