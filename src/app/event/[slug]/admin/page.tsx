'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Heatmap from '@/components/Heatmap';
import { downloadICS, formatUTCInTimezone, getTimezoneAbbr } from '@/lib/utils';
import type { Event, Availability, Participant } from '@/types/database';

function AdminContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const token = searchParams.get('token');

  const [event, setEvent] = useState<Event | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [notifying, setNotifying] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .single();

      if (!eventData) {
        setLoading(false);
        return;
      }

      if (eventData.admin_token !== token) {
        setLoading(false);
        return;
      }

      setAuthorized(true);
      setEvent(eventData);

      const [{ data: avail }, { data: parts }] = await Promise.all([
        supabase.from('availability').select('*').eq('event_id', eventData.id),
        supabase.from('participants').select('*').eq('event_id', eventData.id),
      ]);

      setAvailability(avail || []);
      setParticipants(parts || []);
      setLoading(false);

      // Subscribe to real-time
      const channel = supabase
        .channel(`admin-${eventData.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'availability', filter: `event_id=eq.${eventData.id}` },
          async () => {
            const { data } = await supabase.from('availability').select('*').eq('event_id', eventData.id);
            setAvailability(data || []);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'participants', filter: `event_id=eq.${eventData.id}` },
          async () => {
            const { data } = await supabase.from('participants').select('*').eq('event_id', eventData.id);
            setParticipants(data || []);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    load();
  }, [slug, token]);

  async function handleSelectSlot(slotStart: string, slotEnd: string) {
    if (!event || selecting) return;

    const timeDisplay = event.granularity === 'daily'
      ? new Date(slotStart).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : formatUTCInTimezone(slotStart, event.timezone);
    const confirmMsg = `Select this time?\n${timeDisplay}`;

    if (!confirm(confirmMsg)) return;

    setSelecting(true);

    try {
      // Update event with selected slot
      const { error } = await supabase
        .from('events')
        .update({
          selected_slot: { start: slotStart, end: slotEnd },
        })
        .eq('id', event.id);

      if (error) throw error;

      // Notify participants
      setNotifying(true);
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'time_selected',
          eventId: event.id,
          slotStart,
          slotEnd,
        }),
      });

      // Update local state
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

  if (!authorized || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Not Authorized</h1>
          <p className="text-gray-500">Invalid or missing admin token.</p>
        </div>
      </div>
    );
  }

  const selectedSlot = event.selected_slot as { start: string; end: string } | null;

  return (
    <main className="min-h-screen pb-8">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
            Admin
          </span>
          <span className="text-xs text-gray-400">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{event.name}</h1>
        {event.description && (
          <p className="text-sm text-gray-500 mt-1">{event.description}</p>
        )}
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
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
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

        {/* Participant list */}
        {participants.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Participants</h3>
            <div className="space-y-2">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3"
                >
                  <div>
                    <span className="font-medium text-gray-900">{p.name}</span>
                    {p.email && (
                      <span className="text-xs text-gray-400 ml-2">{p.email}</span>
                    )}
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

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>}>
      <AdminContent />
    </Suspense>
  );
}
