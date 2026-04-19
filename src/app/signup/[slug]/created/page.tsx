'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { Signup } from '@/types/database';

function CreatedContent({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const adminToken = searchParams.get('admin') || '';
  const [signup, setSignup] = useState<Omit<Signup, 'admin_token'> | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('signups')
      .select('id, slug, name, description, type, organizer_email, recipient_name, dietary_notes, dropoff_location, created_at')
      .eq('slug', slug)
      .single()
      .then(({ data }) => {
        setSignup(data);
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  if (!signup) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-gray-500">Sign-up not found</p>
      </main>
    );
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${appUrl}/signup/${slug}`;
  const adminUrl = `${appUrl}/signup/${slug}/admin#token=${adminToken}`;

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {signup.type === 'potluck' ? 'Potluck' : 'Sign-Up Sheet'} Created!
          </h1>
          <p className="text-gray-500">{signup.name}</p>
        </div>

        <div className="space-y-4">
          {/* Share Link */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Share this link with participants
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm bg-gray-50 text-gray-700"
              />
              <button
                onClick={() => copyToClipboard(shareUrl, 'share')}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {copied === 'share' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Admin Link */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Admin link (save this!)
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Use this link to manage sign-ups and remove claims.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={adminUrl}
                readOnly
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm bg-gray-50 text-gray-700"
              />
              <button
                onClick={() => copyToClipboard(adminUrl, 'admin')}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
              >
                {copied === 'admin' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <a
              href={shareUrl}
              className="text-center py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl transition-colors"
            >
              View Page
            </a>
            <a
              href={adminUrl}
              className="text-center py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border border-gray-300 transition-colors"
            >
              Admin Panel
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

function CreatedPageInner() {
  const params = useParams();
  const slug = params.slug as string;
  return <CreatedContent slug={slug} />;
}

export default function SignupCreatedPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </main>
    }>
      <CreatedPageInner />
    </Suspense>
  );
}
