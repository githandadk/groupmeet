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

interface SignupInfo {
  id: string;
  slug: string;
  admin_token: string;
  name: string;
  type: 'timeslot' | 'potluck' | 'mealtrain';
  organizer_email: string | null;
  created_at: string | null;
  claim_count: number;
}

interface PollInfo {
  id: string;
  slug: string;
  admin_token: string;
  title: string;
  closed: boolean;
  created_at: string | null;
}

export default function SuperAdminPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [signups, setSignups] = useState<SignupInfo[]>([]);
  const [polls, setPolls] = useState<PollInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [tab, setTab] = useState<'events' | 'signups' | 'polls'>('events');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const post = (action: string) =>
        fetch('/api/superadmin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });

      const [eventsRes, signupsRes, pollsRes] = await Promise.all([
        post('list'), post('list_signups'), post('list_polls'),
      ]);

      if (eventsRes.status === 401) {
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      const [eventsData, signupsData, pollsData] = await Promise.all([
        eventsRes.json(), signupsRes.json(), pollsRes.json(),
      ]);

      setEvents(eventsData.events || []);
      setSignups(signupsData.signups || []);
      setPolls(pollsData.polls || []);
      setAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount, check session
  useEffect(() => {
    fetch('/api/superadmin/me')
      .then((r) => {
        if (r.ok) loadAll();
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [loadAll]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setError('');
    try {
      const res = await fetch('/api/superadmin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError('Invalid password');
        return;
      }
      setPassword('');
      await loadAll();
    } catch {
      setError('Login failed');
    }
  }

  async function handleLogout() {
    await fetch('/api/superadmin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    setAuthenticated(false);
  }

  async function handleDelete(action: string, idKey: string, id: string, name: string, listSetter: (fn: (prev: { id: string }[]) => { id: string }[]) => void) {
    if (!confirm(`Delete "${name}" and all its data? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, [idKey]: id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      listSetter((prev) => prev.filter((x) => x.id !== id));
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

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  function adminPath(kind: 'event' | 'signup' | 'poll', slug: string, token: string): string {
    return `${appUrl}/${kind === 'event' ? 'event' : kind === 'poll' ? 'poll' : 'signup'}/${slug}/admin#token=${token}`;
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
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
          {error && (<p className="text-red-600 text-sm text-center">{error}</p>)}
          <button
            type="submit"
            className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl transition-colors"
          >
            Log In
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
          <p className="text-sm text-gray-500">
            {events.length} event{events.length !== 1 ? 's' : ''}, {signups.length} sign-up{signups.length !== 1 ? 's' : ''}, {polls.length} poll{polls.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAll} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">Refresh</button>
          <button onClick={handleLogout} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">Log out</button>
        </div>
      </div>

      <div className="px-4 max-w-3xl mx-auto">
        <div className="flex border-b border-gray-200 mt-4 mb-4">
          {(['events', 'signups', 'polls'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'events' ? `Events (${events.length})` : t === 'signups' ? `Sign-Ups (${signups.length})` : `Polls (${polls.length})`}
            </button>
          ))}
        </div>

        {tab === 'events' && (
          <div className="space-y-3">
            {events.length === 0 && (<p className="text-center text-gray-400 py-8">No events yet.</p>)}
            {events.map((event) => {
              const status = getStatus(event);
              return (
                <div key={event.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-semibold text-gray-900 truncate">{event.name}</h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>{status.label}</span>
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        {event.date_range_start} to {event.date_range_end}
                        <span className="mx-2 text-gray-300">|</span>{event.granularity}
                        <span className="mx-2 text-gray-300">|</span>{event.participant_count} participant{event.participant_count !== 1 ? 's' : ''}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a href={adminPath('event', event.slug, event.admin_token)} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:text-indigo-600 font-medium">Admin Link</a>
                        <a href={`${appUrl}/event/${event.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-600 font-medium">Participant Link</a>
                        <a href={`${appUrl}/event/${event.slug}/results`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-600 font-medium">Results</a>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete('delete', 'eventId', event.id, event.name, setEvents as never)}
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
        )}

        {tab === 'signups' && (
          <div className="space-y-3">
            {signups.length === 0 && (<p className="text-center text-gray-400 py-8">No sign-ups yet.</p>)}
            {signups.map((signup) => (
              <div key={signup.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-gray-900 truncate">{signup.name}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        signup.type === 'potluck' ? 'bg-amber-100 text-amber-700'
                          : signup.type === 'mealtrain' ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {signup.type === 'potluck' ? 'Potluck' : signup.type === 'mealtrain' ? 'Meal Train' : 'Sign-Up'}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {signup.claim_count} claim{signup.claim_count !== 1 ? 's' : ''}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a href={adminPath('signup', signup.slug, signup.admin_token)} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:text-indigo-600 font-medium">Admin Link</a>
                      <a href={`${appUrl}/${signup.type === 'mealtrain' ? 'mealtrain' : 'signup'}/${signup.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-600 font-medium">Participant Link</a>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete('delete_signup', 'signupId', signup.id, signup.name, setSignups as never)}
                    disabled={deleting === signup.id}
                    className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {deleting === signup.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'polls' && (
          <div className="space-y-3">
            {polls.length === 0 && (<p className="text-center text-gray-400 py-8">No polls yet.</p>)}
            {polls.map((poll) => (
              <div key={poll.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-gray-900 truncate">{poll.title}</h2>
                      {poll.closed && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">Closed</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a href={adminPath('poll', poll.slug, poll.admin_token)} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:text-indigo-600 font-medium">Admin Link</a>
                      <a href={`${appUrl}/poll/${poll.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-600 font-medium">Participant Link</a>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete('delete_poll', 'pollId', poll.id, poll.title, setPolls as never)}
                    disabled={deleting === poll.id}
                    className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {deleting === poll.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
