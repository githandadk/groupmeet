'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getDatesInRange, formatDate } from '@/lib/utils';

export default function NewMealTrainPage() {
  const router = useRouter();
  const [recipientName, setRecipientName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dietaryNotes, setDietaryNotes] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [organizerEmail, setOrganizerEmail] = useState('');
  const [skippedDates, setSkippedDates] = useState<Set<string>>(new Set());
  const [mealsPerDay, setMealsPerDay] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const dates = useMemo(() => {
    if (!dateStart || !dateEnd || dateStart > dateEnd) return [];
    return getDatesInRange(dateStart, dateEnd);
  }, [dateStart, dateEnd]);

  const activeDates = dates.filter((d) => !skippedDates.has(d));

  function toggleDate(d: string) {
    setSkippedDates((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  }

  // Auto-fill title from recipient name
  function applyDefaultTitle() {
    if (!title.trim() && recipientName.trim()) {
      setTitle(`Meal Train for ${recipientName.trim()}`);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!recipientName.trim()) { setError('Recipient name is required'); return; }
    if (!dateStart || !dateEnd) { setError('Start and end dates are required'); return; }
    if (dateStart > dateEnd) { setError('End date must be after start date'); return; }
    if (activeDates.length === 0) { setError('Select at least one day'); return; }

    const finalTitle = title.trim() || `Meal Train for ${recipientName.trim()}`;

    const items = activeDates.map((date) => ({
      label: formatDate(date),
      capacity: mealsPerDay,
      date,
    }));

    setLoading(true);
    try {
      const res = await fetch('/api/signups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalTitle,
          description: description.trim() || null,
          type: 'mealtrain',
          organizerEmail: organizerEmail.trim() || null,
          recipientName: recipientName.trim(),
          dietaryNotes: dietaryNotes.trim() || null,
          dropoffLocation: dropoffLocation.trim() || null,
          items,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create meal train');
      }
      const data = await res.json();
      router.push(`/mealtrain/${data.slug}/created#token=${data.adminToken}`);
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
          <p className="text-gray-500">Coordinate meals for a family in need</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Family / Recipient Name *</label>
            <input
              type="text" value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              onBlur={applyDefaultTitle}
              placeholder="The Smith family"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text" value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Defaults to: Meal Train for [recipient]"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Why (optional)</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="New baby, recovering from surgery, etc."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base resize-none"
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dietary Notes / Allergies</label>
            <textarea
              value={dietaryNotes} onChange={(e) => setDietaryNotes(e.target.value)}
              placeholder="No nuts, vegetarian, kids prefer mild flavors..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base resize-none"
              maxLength={2000}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Drop-off Instructions</label>
            <textarea
              value={dropoffLocation} onChange={(e) => setDropoffLocation(e.target.value)}
              placeholder="Address, best time to drop off, leave on porch, etc."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base resize-none"
              maxLength={2000}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
              <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} min={dateStart}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm" />
            </div>
          </div>

          {dates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Days needing meals ({activeDates.length}/{dates.length})
              </label>
              <div className="grid grid-cols-3 gap-2">
                {dates.map((d) => {
                  const skipped = skippedDates.has(d);
                  return (
                    <button
                      key={d} type="button" onClick={() => toggleDate(d)}
                      className={`py-2 px-2 rounded-lg text-xs font-medium border transition-colors ${
                        skipped
                          ? 'bg-gray-50 border-gray-200 text-gray-400'
                          : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      }`}
                    >
                      {formatDate(d)}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">Tap a day to skip it.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meals per day</label>
            <input type="number" min={1} max={10} value={mealsPerDay}
              onChange={(e) => setMealsPerDay(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base" />
            <p className="text-xs text-gray-400 mt-1">e.g. 2 if both lunch and dinner are needed.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Email (optional)</label>
            <input type="email" value={organizerEmail} onChange={(e) => setOrganizerEmail(e.target.value)}
              placeholder="Get notified when people sign up"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base" />
          </div>

          {error && (<div className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</div>)}

          <button type="submit" disabled={loading}
            className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl text-base transition-colors disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Meal Train'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-8">
          No account required. Share the link and start organizing.
        </p>
      </div>
    </main>
  );
}
