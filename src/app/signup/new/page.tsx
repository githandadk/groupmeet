'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { getDatesInRange, getTimeSlots, formatMinutes } from '@/lib/utils';

interface ItemDraft {
  id: string;
  label: string;
  description: string;
  capacity: number;
}

function NewSignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = searchParams.get('type') === 'potluck' ? 'potluck' : 'timeslot';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'timeslot' | 'potluck'>(initialType);
  const [organizerEmail, setOrganizerEmail] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([
    { id: '1', label: '', description: '', capacity: 1 },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Date schedule state
  const [useDates, setUseDates] = useState(false);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [timeStart, setTimeStart] = useState(9); // hour 0-23
  const [timeEnd, setTimeEnd] = useState(17);
  const [granularity, setGranularity] = useState<'hourly' | 'half-hour'>('hourly');
  const [slotCapacity, setSlotCapacity] = useState(1);

  useEffect(() => {
    setType(searchParams.get('type') === 'potluck' ? 'potluck' : 'timeslot');
  }, [searchParams]);

  // Auto-generate items from date schedule
  const generatedItems = useMemo(() => {
    if (!useDates || !dateStart || !dateEnd) return [];
    const dates = getDatesInRange(dateStart, dateEnd);
    const stepMinutes = granularity === 'half-hour' ? 30 : 60;
    const slots = getTimeSlots(timeStart, timeEnd, stepMinutes);
    if (dates.length === 0 || slots.length === 0) return [];

    const result: { label: string; date: string; capacity: number }[] = [];
    for (const date of dates) {
      for (const slotMins of slots) {
        const endMins = slotMins + stepMinutes;
        result.push({
          label: `${formatMinutes(slotMins)} - ${formatMinutes(endMins)}`,
          date,
          capacity: slotCapacity,
        });
      }
    }
    return result.slice(0, 500);
  }, [useDates, dateStart, dateEnd, timeStart, timeEnd, granularity, slotCapacity]);

  const dateCount = useMemo(() => {
    if (!dateStart || !dateEnd) return 0;
    return getDatesInRange(dateStart, dateEnd).length;
  }, [dateStart, dateEnd]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: Date.now().toString(), label: '', description: '', capacity: 1 },
    ]);
  }

  function removeItem(id: string) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function updateItem(id: string, field: keyof ItemDraft, value: string | number) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    let submitItems: { label: string; description?: string | null; capacity: number; date?: string }[];

    if (type === 'timeslot' && useDates) {
      if (!dateStart || !dateEnd) {
        setError('Start and end dates are required');
        return;
      }
      if (dateStart > dateEnd) {
        setError('End date must be after start date');
        return;
      }
      if (timeStart >= timeEnd) {
        setError('End time must be after start time');
        return;
      }
      if (generatedItems.length === 0) {
        setError('No slots generated. Check your date and time range.');
        return;
      }
      if (generatedItems.length > 500) {
        setError('Too many slots (max 500). Reduce the date range or increase granularity.');
        return;
      }
      submitItems = generatedItems.map((item) => ({
        label: item.label,
        capacity: item.capacity,
        date: item.date,
      }));
    } else {
      const validItems = items.filter((item) => item.label.trim());
      if (validItems.length === 0) {
        setError('At least one item with a label is required');
        return;
      }
      submitItems = validItems.map((item) => ({
        label: item.label.trim(),
        description: item.description.trim() || null,
        capacity: item.capacity,
      }));
    }

    setLoading(true);

    try {
      const res = await fetch('/api/signups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          type,
          organizerEmail: organizerEmail.trim() || null,
          items: submitItems,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create signup');
      }

      const data = await res.json();
      router.push(`/signup/${data.slug}/created?admin=${data.adminToken}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const itemLabel = type === 'potluck' ? 'Item' : 'Slot';
  const itemPlaceholder = type === 'potluck' ? 'e.g. Main dish, Side, Dessert...' : 'e.g. 9 AM - 10 AM, Setup crew...';

  // Build hour options for time selects
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="/" className="text-3xl font-bold text-gray-900 mb-2 block hover:text-indigo-600 transition-colors">Group Tools</a>
          <p className="text-gray-500">
            {type === 'potluck' ? 'Organize who brings what' : 'Create a sign-up sheet'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <div className="flex rounded-xl overflow-hidden border border-gray-300">
              {([['timeslot', 'Sign-Up Sheet'], ['potluck', 'Potluck']] as const).map(
                ([value, label], i) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      i > 0 ? 'border-l border-gray-300' : ''
                    } ${
                      type === value
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

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              {type === 'potluck' ? 'Potluck Name' : 'Sign-Up Name'} *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'potluck' ? 'Holiday Potluck, Team Lunch...' : 'Volunteer Shifts, Carpool...'}
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
              placeholder="Optional details..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base resize-none"
              maxLength={500}
            />
          </div>

          {/* Date schedule toggle — only for timeslot type */}
          {type === 'timeslot' && (
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    useDates ? 'bg-indigo-500' : 'bg-gray-300'
                  }`}
                  onClick={() => setUseDates(!useDates)}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      useDates ? 'translate-x-5' : ''
                    }`}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700">Schedule with dates</span>
              </label>

              {useDates && (
                <div className="mt-4 space-y-4 bg-gray-50 rounded-xl p-4">
                  {/* Date range */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={dateStart}
                        onChange={(e) => setDateStart(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">End Date</label>
                      <input
                        type="date"
                        value={dateEnd}
                        onChange={(e) => setDateEnd(e.target.value)}
                        min={dateStart}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                      />
                    </div>
                  </div>

                  {/* Time range */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                      <select
                        value={timeStart}
                        onChange={(e) => setTimeStart(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                      >
                        {hourOptions.map((h) => (
                          <option key={h} value={h}>{formatMinutes(h * 60)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">End Time</label>
                      <select
                        value={timeEnd}
                        onChange={(e) => setTimeEnd(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                      >
                        {hourOptions.filter((h) => h > timeStart).map((h) => (
                          <option key={h} value={h}>{formatMinutes(h * 60)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Granularity + capacity */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Slot Length</label>
                      <div className="flex rounded-lg overflow-hidden border border-gray-300">
                        {([['hourly', '1 Hour'], ['half-hour', '30 Min']] as const).map(
                          ([value, label], i) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setGranularity(value)}
                              className={`flex-1 py-2 text-xs font-medium transition-colors ${
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
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Spots per Slot</label>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={slotCapacity}
                        onChange={(e) => setSlotCapacity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm text-center"
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  {generatedItems.length > 0 && (
                    <div className="text-sm text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2">
                      {generatedItems.length} slot{generatedItems.length !== 1 ? 's' : ''} across {dateCount} day{dateCount !== 1 ? 's' : ''}
                    </div>
                  )}
                  {generatedItems.length >= 500 && (
                    <div className="text-xs text-amber-600">
                      Capped at 500 slots. Reduce the date range or increase slot length.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Manual items — hidden when date mode is active */}
          {!(type === 'timeslot' && useDates) && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  {type === 'potluck' ? 'Items' : 'Slots'} *
                </label>
                <button
                  type="button"
                  onClick={addItem}
                  className="text-sm text-indigo-500 hover:text-indigo-600 font-medium"
                >
                  + Add {itemLabel}
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.id} className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-medium w-5">{index + 1}.</span>
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => updateItem(item.id, 'label', e.target.value)}
                        placeholder={itemPlaceholder}
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                        maxLength={100}
                      />
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-7">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Description (optional)"
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                        maxLength={200}
                      />
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-500 whitespace-nowrap">Spots:</label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={item.capacity}
                          onChange={(e) => updateItem(item.id, 'capacity', Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-14 px-2 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm text-center"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
              placeholder="Get notified when people sign up"
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
            {loading ? 'Creating...' : `Create ${type === 'potluck' ? 'Potluck' : 'Sign-Up Sheet'}`}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-8">
          No account required. Share the link and start organizing.
        </p>
      </div>
    </main>
  );
}

export default function NewSignupPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </main>
    }>
      <NewSignupForm />
    </Suspense>
  );
}
