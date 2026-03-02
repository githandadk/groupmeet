'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserTimezone, getTimezoneAbbr, US_TIMEZONES } from '@/lib/utils';

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [granularity, setGranularity] = useState<'hourly' | 'half-hour' | 'daily'>('hourly');
  const [timeStart, setTimeStart] = useState(8);
  const [timeEnd, setTimeEnd] = useState(22);
  const [organizerEmail, setOrganizerEmail] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setTimezone(getUserTimezone());
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const maxDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Event name is required');
      return;
    }
    if (!dateStart || !dateEnd) {
      setError('Please select a date range');
      return;
    }
    if (new Date(dateEnd) < new Date(dateStart)) {
      setError('End date must be after start date');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          dateStart,
          dateEnd,
          granularity,
          timeStart: granularity !== 'daily' ? timeStart : 0,
          timeEnd: granularity !== 'daily' ? timeEnd : 24,
          organizerEmail: organizerEmail.trim() || null,
          timezone,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create event');
      }

      const data = await res.json();
      router.push(`/event/${data.slug}/created?admin=${data.adminToken}`);
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">GroupMeet</h1>
          <p className="text-gray-500">Find a time that works for everyone</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Event Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Team standup, Book club, Game night..."
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
              maxLength={100}
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details about the event..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base resize-none"
              maxLength={500}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="dateStart" className="block text-sm font-medium text-gray-700 mb-1">
                Start Date *
              </label>
              <input
                id="dateStart"
                type="date"
                value={dateStart}
                min={today}
                max={maxDate}
                onChange={(e) => {
                  setDateStart(e.target.value);
                  if (!dateEnd || e.target.value > dateEnd) {
                    setDateEnd(e.target.value);
                  }
                }}
                className="w-full px-3 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
              />
            </div>
            <div>
              <label htmlFor="dateEnd" className="block text-sm font-medium text-gray-700 mb-1">
                End Date *
              </label>
              <input
                id="dateEnd"
                type="date"
                value={dateEnd}
                min={dateStart || today}
                max={maxDate}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-full px-3 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time Granularity</label>
            <div className="flex rounded-xl overflow-hidden border border-gray-300">
              {([['half-hour', '30-Min'], ['hourly', '1-Hour'], ['daily', 'Full Day']] as const).map(
                ([value, label], i) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGranularity(value)}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      i > 0 ? 'border-l border-gray-300' : ''
                    } ${
                      granularity === value
                        ? 'bg-indigo-500 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </div>

          {granularity !== 'daily' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="timeStart" className="block text-sm font-medium text-gray-700 mb-1">
                  Earliest Time
                </label>
                <select
                  id="timeStart"
                  value={timeStart}
                  onChange={(e) => setTimeStart(Number(e.target.value))}
                  className="w-full px-3 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base bg-white"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? '12 AM' : i === 12 ? '12 PM' : i < 12 ? `${i} AM` : `${i - 12} PM`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="timeEnd" className="block text-sm font-medium text-gray-700 mb-1">
                  Latest Time
                </label>
                <select
                  id="timeEnd"
                  value={timeEnd}
                  onChange={(e) => setTimeEnd(Number(e.target.value))}
                  className="w-full px-3 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base bg-white"
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h}>
                      {h === 24
                        ? '12 AM'
                        : h === 12
                          ? '12 PM'
                          : h < 12
                            ? `${h} AM`
                            : `${h - 12} PM`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {granularity !== 'daily' && (
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
                Timezone
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base bg-white"
              >
                {US_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, ' ')} ({getTimezoneAbbr(tz)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Your Email (optional)
            </label>
            <input
              id="email"
              type="email"
              value={organizerEmail}
              onChange={(e) => setOrganizerEmail(e.target.value)}
              placeholder="Get notified when people respond"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Event'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-8">
          No account required. Share the link and start scheduling.
        </p>
      </div>
    </main>
  );
}
