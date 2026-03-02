'use client';

import { useState, useEffect, useCallback } from 'react';

interface EventInfo {
  id: string;
  slug: string;
  admin_token: string;
  name: string;
  date_range_start: string;
  date_range_end: string;
  granularity: string;
  organizer_email: string | null;
  selected_slot: unknown;
  created_at: string | null;
  participant_count: number;
}

export default function SuperAdminPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadEvents = useCallback(async (pw: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': pw,
        },
        body: JSON.stringify({ action: 'list' }),
      });

      if (res.status === 401) {
        setError('Invalid password');
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setEvents(data.events);
      setAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('sa_pw');
    if (saved) {
      setPassword(saved);
      loadEvents(saved);
    }
  }, [loadEvents]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    sessionStorage.setItem('sa_pw', password);
    loadEvents(password);
  }

  async function handleDelete(eventId: string, eventName: string) {
    if (!confirm(`Delete "${eventName}" and all its data? This cannot be undone.`)) return;

    setDeleting(eventId);
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password,
        },
        body: JSON.stringify({ action: 'delete', eventId }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  function getStatus(event: EventInfo): { label: string; color: string } {
    if (event.selected_slot) return { label: 'Finalized', color: 'bg-green-100 text-green-700' };
    const endDate = new Date(event.date_range_end + 'T23:59:59');
    if (endDate < new Date()) return { label: 'Past', color: 'bg-gray-100 text-gray-500' };
    return { label: 'Active', color: 'bg-indigo-100 text-indigo-700' };
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-gray-900 text-center">Super Admin</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
            autoFocus
          />
          {error && (
            <p className="text-red-600 text-sm text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Log In'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-8">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Super Admin</h1>
          <p className="text-sm text-gray-500">{events.length} event{events.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => loadEvents(password)}
          disabled={loading}
          className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="px-4 py-4 max-w-3xl mx-auto space-y-3">
        {events.length === 0 && (
          <p className="text-center text-gray-400 py-8">No events yet.</p>
        )}

        {events.map((event) => {
          const status = getStatus(event);
          const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

          return (
            <div
              key={event.id}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-gray-900 truncate">{event.name}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="mt-1 text-sm text-gray-500">
                    {event.date_range_start} to {event.date_range_end}
                    <span className="mx-2 text-gray-300">|</span>
                    {event.granularity}
                    <span className="mx-2 text-gray-300">|</span>
                    {event.participant_count} participant{event.participant_count !== 1 ? 's' : ''}
                  </div>

                  {event.organizer_email && (
                    <p className="text-xs text-gray-400 mt-1">{event.organizer_email}</p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-2">
                    <a
                      href={`${appUrl}/event/${event.slug}/admin?token=${event.admin_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-500 hover:text-indigo-600 font-medium"
                    >
                      Admin Link
                    </a>
                    <a
                      href={`${appUrl}/event/${event.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-gray-600 font-medium"
                    >
                      Participant Link
                    </a>
                    <a
                      href={`${appUrl}/event/${event.slug}/results`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-gray-600 font-medium"
                    >
                      Results
                    </a>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(event.id, event.name)}
                  disabled={deleting === event.id}
                  className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {deleting === event.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
