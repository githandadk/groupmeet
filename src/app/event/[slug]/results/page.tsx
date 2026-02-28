'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Heatmap from '@/components/Heatmap';
import type { Event, Availability, Participant } from '@/types/database';

export default function ResultsPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

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

      setEvent(eventData);

      const [{ data: avail }, { data: parts }] = await Promise.all([
        supabase.from('availability').select('*').eq('event_id', eventData.id),
        supabase.from('participants').select('*').eq('event_id', eventData.id),
      ]);

      setAvailability(avail || []);
      setParticipants(parts || []);
      setLoading(false);

      // Subscribe to real-time changes
      const channel = supabase
        .channel(`results-${eventData.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'availability', filter: `event_id=eq.${eventData.id}` },
          async () => {
            const { data: newAvail } = await supabase
              .from('availability')
              .select('*')
              .eq('event_id', eventData.id);
            setAvailability(newAvail || []);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'participants', filter: `event_id=eq.${eventData.id}` },
          async () => {
            const { data: newParts } = await supabase
              .from('participants')
              .select('*')
              .eq('event_id', eventData.id);
            setParticipants(newParts || []);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Event not found</h1>
          <p className="text-gray-500">This link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  const selectedSlot = event.selected_slot as { start: string; end: string } | null;

  return (
    <main className="min-h-screen pb-8">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">{event.name}</h1>
        {event.description && (
          <p className="text-sm text-gray-500 mt-1">{event.description}</p>
        )}
        <div className="flex items-center gap-4 mt-2">
          <span className="text-xs text-gray-400">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </span>
          <span className="text-xs text-green-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Live
          </span>
        </div>
      </div>

      {selectedSlot && (
        <div className="mx-4 mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-medium text-green-800">
            Time selected by organizer:
          </p>
          <p className="text-green-700 font-bold mt-1">
            {new Date(selectedSlot.start).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}{' '}
            {event.granularity === 'hourly' &&
              `at ${new Date(selectedSlot.start).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}`}
          </p>
        </div>
      )}

      <div className="px-4 py-4 max-w-2xl mx-auto">
        <Heatmap
          event={event}
          availability={availability}
          participants={participants}
        />

        {/* Participant list */}
        {participants.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Participants</h3>
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-3 py-1 text-sm text-gray-700"
                >
                  <span className="w-2 h-2 bg-indigo-400 rounded-full" />
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <a
            href={`/event/${slug}`}
            className="text-indigo-500 font-medium text-sm hover:text-indigo-600"
          >
            ← Add Your Availability
          </a>
        </div>
      </div>
    </main>
  );
}
