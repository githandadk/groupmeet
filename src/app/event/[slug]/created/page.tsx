'use client';

import { useSearchParams, useParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';

function CreatedContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const adminToken = searchParams.get('admin');
  const [copied, setCopied] = useState(false);
  const [copiedAdmin, setCopiedAdmin] = useState(false);
  const [appUrl, setAppUrl] = useState('');

  useEffect(() => {
    setAppUrl(window.location.origin);
  }, []);

  const shareLink = `${appUrl}/event/${slug}`;
  const adminLink = `${appUrl}/event/${slug}/admin?token=${adminToken}`;

  async function copyToClipboard(text: string, type: 'share' | 'admin') {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'share') {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        setCopiedAdmin(true);
        setTimeout(() => setCopiedAdmin(false), 2000);
      }
    } catch {
      // Fallback
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Event Created!</h1>
          <p className="text-gray-500">Share the link below with your group</p>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Share this link with participants
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareLink}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-sm truncate"
              />
              <button
                onClick={() => copyToClipboard(shareLink, 'share')}
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors whitespace-nowrap"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <label className="block text-sm font-medium text-amber-800 mb-2">
              Your admin link (save this!)
            </label>
            <p className="text-xs text-amber-600 mb-2">
              Use this link to view results and pick the final time.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={adminLink}
                className="flex-1 px-3 py-2 rounded-lg border border-amber-300 bg-white text-sm truncate"
              />
              <button
                onClick={() => copyToClipboard(adminLink, 'admin')}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors whitespace-nowrap"
              >
                {copiedAdmin ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <a
              href={shareLink}
              className="flex-1 py-3 text-center bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
            >
              View Event
            </a>
            <a
              href={`/event/${slug}/results`}
              className="flex-1 py-3 text-center bg-indigo-500 text-white font-medium rounded-xl hover:bg-indigo-600 transition-colors text-sm"
            >
              View Results
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function CreatedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>}>
      <CreatedContent />
    </Suspense>
  );
}
