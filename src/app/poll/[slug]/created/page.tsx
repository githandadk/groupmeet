'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function PollCreatedPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [adminToken, setAdminToken] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setAppUrl(window.location.origin);
    const hash = window.location.hash.replace(/^#/, '');
    setAdminToken(new URLSearchParams(hash).get('token') || '');
  }, []);

  const shareUrl = `${appUrl}/poll/${slug}`;
  const adminUrl = `${appUrl}/poll/${slug}/admin#token=${adminToken}`;

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Poll Created!</h1>
          <p className="text-gray-500">Share the link to start collecting votes.</p>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Share this link with voters</label>
            <div className="flex gap-2">
              <input type="text" readOnly value={shareUrl}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-sm truncate" />
              <button onClick={() => copy(shareUrl, 'share')}
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors whitespace-nowrap">
                {copied === 'share' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <label className="block text-sm font-medium text-amber-800 mb-2">Your admin link (save this!)</label>
            <p className="text-xs text-amber-600 mb-2">Use this link to close the poll or remove votes.</p>
            <div className="flex gap-2">
              <input type="text" readOnly value={adminUrl}
                className="flex-1 px-3 py-2 rounded-lg border border-amber-300 bg-white text-sm truncate" />
              <button onClick={() => copy(adminUrl, 'admin')}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors whitespace-nowrap">
                {copied === 'admin' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <a href={shareUrl} className="text-center py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl transition-colors">View Poll</a>
            <a href={adminUrl} className="text-center py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border border-gray-300 transition-colors">Admin Panel</a>
          </div>
        </div>
      </div>
    </main>
  );
}
