'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface OptionDraft { id: string; label: string; }

export default function NewPollPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<OptionDraft[]>([
    { id: '1', label: '' }, { id: '2', label: '' },
  ]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function addOption() {
    if (options.length >= 10) return;
    setOptions((prev) => [...prev, { id: Date.now().toString(), label: '' }]);
  }
  function removeOption(id: string) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((o) => o.id !== id));
  }
  function updateOption(id: string, label: string) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, label } : o)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!title.trim()) { setError('Title is required'); return; }
    const validOptions = options.map((o) => o.label.trim()).filter(Boolean);
    if (validOptions.length < 2) { setError('At least 2 options are required'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          options: validOptions.map((label) => ({ label })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create poll');
      }
      const data = await res.json();
      router.push(`/poll/${data.slug}/created#token=${data.adminToken}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="/" className="text-3xl font-bold text-gray-900 mb-2 block hover:text-indigo-600 transition-colors">Group Tools</a>
          <p className="text-gray-500">Create a quick group poll</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question / Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Which book should we study next?"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
              maxLength={200} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="Optional context"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base resize-none"
              maxLength={2000} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">Options *</label>
              <button type="button" onClick={addOption} disabled={options.length >= 10}
                className="text-sm text-indigo-500 hover:text-indigo-600 font-medium disabled:opacity-50">
                + Add Option
              </button>
            </div>
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={o.id} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-medium w-5">{i + 1}.</span>
                  <input type="text" value={o.label} onChange={(e) => updateOption(o.id, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                    maxLength={100} />
                  {options.length > 2 && (
                    <button type="button" onClick={() => removeOption(o.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">2–10 options. Voters pick one.</p>
          </div>

          {error && (<div className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</div>)}

          <button type="submit" disabled={loading}
            className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl text-base transition-colors disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Poll'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-8">
          No account required. Share the link and start voting.
        </p>
      </div>
    </main>
  );
}
