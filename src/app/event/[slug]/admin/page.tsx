'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Heatmap from '@/components/Heatmap';
import { downloadICS, formatUTCInTimezone, getTimezoneAbbr } from '@/lib/utils';
import type { Event, Availability, Participant } from '@/types/database';

export default function EventAdminPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [adminToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return null;
    return new URLSearchParams(hash).get('token');
  });
  const scrubbedRef = useRef(false);
  const [event, setEvent] = useState<Omit<Event, 'admin_token'> | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [notifying, setNotifying] = useState(false);

  // Scrub the hash once after mount (Strict Mode-safe)
  useEffect(() => {
    if (scrubbedRef.current) return;
    scrubbedRef.current = true;
    if (typeof window !== 'undefined' && window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  const loadAll = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/events/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load', slug, adminToken: token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAuthError(data.error || 'Not authorized');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setEvent(data.event);
      setAvailability(data.availability);
      setParticipants(data.participants);
      setLoading(false);
    } catch {
      setAuthError('Failed to load');
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!adminToken) {
      setAuthError('Missing admin token');
      setLoading(false);
      return;
    }
    loadAll(adminToken);
  }, [adminToken, loadAll]);

  // Realtime updates (uses anon key — read-only, narrowed columns)
  useEffect(() => {
    if (!event) return;
    const channel = supabase
      .channel(`admin-${event.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'availability', filter: `event_id=eq.${event.id}` },
        async () => {
          const { data } = await supabase
            .from('availability')
            .select('id, event_id, participant_id, slot_start, slot_end')
            .eq('event_id', event.id);
          setAvailability(data || []);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `event_id=eq.${event.id}` },
        async () => {
          // Note: anon key cannot read email; admin viewer reloads via API for fresh email data.
          if (!adminToken) return;
          const res = await fetch('/api/events/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'load', slug, adminToken }),
          });
          if (res.ok) {
            const d = await res.json();
            setParticipants(d.participants);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event, adminToken, slug]);

  async function handleSelectSlot(slotStart: string, slotEnd: string) {
    if (!event || !adminToken || selecting) return;

    const timeDisplay = event.granularity === 'daily'
      ? new Date(slotStart).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : formatUTCInTimezone(slotStart, event.timezone);

    if (!confirm(`Select this time?\n${timeDisplay}`)) return;

    setSelecting(true);
    try {
      const res = await fetch('/api/events/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'select_slot', slug, adminToken, slotStart, slotEnd }),
      });
      if (!res.ok) throw new Error('Failed to select slot');

      setNotifying(true);
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'time_selected',
          eventSlug: slug,
          adminToken,
          slotStart,
          slotEnd,
        }),
      });

      setEvent({ ...event, selected_slot: { start: slotStart, end: slotEnd } });
    } catch {
      alert('Failed to select time. Please try again.');
    } finally {
      setSelecting(false);
      setNotifying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (authError || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Not Authorized</h1>
          <p className="text-gray-500">{authError || 'Invalid or missing admin token.'}</p>
        </div>
      </div>
    );
  }

  const selectedSlot = event.selected_slot as { start: string; end: string } | null;

  return (
    <main className="min-h-screen pb-8">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Admin</span>
          <span className="text-xs text-gray-400">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{event.name}</h1>
        {event.description && (<p className="text-sm text-gray-500 mt-1">{event.description}</p>)}
      </div>

      {selecting && (
        <div className="mx-4 mt-4 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center gap-3">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500" />
          <span className="text-sm text-indigo-700">
            {notifying ? 'Notifying participants...' : 'Selecting time...'}
          </span>
        </div>
      )}

      {selectedSlot && (
        <div className="mx-4 mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-medium text-green-800 mb-1">Selected Time</p>
          <p className="text-green-700 font-bold">
            {event.granularity === 'daily'
              ? new Date(selectedSlot.start).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric',
                })
              : formatUTCInTimezone(selectedSlot.start, event.timezone)}
          </p>
          {event.granularity !== 'daily' && (
            <p className="text-xs text-green-600 mt-1">{getTimezoneAbbr(event.timezone)}</p>
          )}
          <button
            onClick={() => downloadICS(event.name, event.description, selectedSlot.start, selectedSlot.end)}
            className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            Download .ics File
          </button>
        </div>
      )}

      <div className="px-4 py-4 max-w-2xl mx-auto">
        {!selectedSlot && (
          <div className="bg-indigo-50 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-indigo-700">
              Tap a time slot or card below to select the final time. All participants with emails will be notified.
            </p>
          </div>
        )}

        <Heatmap
          event={event}
          availability={availability}
          participants={participants}
          onSelectSlot={selectedSlot ? undefined : handleSelectSlot}
        />

        {participants.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Participants</h3>
            <div className="space-y-2">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
                  <div>
                    <span className="font-medium text-gray-900">{p.name}</span>
                    {p.email && (<span className="text-xs text-gray-400 ml-2">{p.email}</span>)}
                  </div>
                  <span className="text-xs text-gray-400">
                    {p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
