'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import AvailabilityGrid from '@/components/AvailabilityGrid';
import type { Event } from '@/types/database';

export default function EventPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [existingParticipantId, setExistingParticipantId] = useState<string | null>(null);

  const loadExistingAvailability = useCallback(async (eventId: string, participantId: string) => {
    const { data: slots } = await supabase
      .from('availability')
      .select('slot_start')
      .eq('participant_id', participantId)
      .eq('event_id', eventId);

    if (slots && slots.length > 0) {
      const existing = new Set<string>();
      slots.forEach((s) => {
        const dt = new Date(s.slot_start);
        const dateStr = dt.toISOString().split('T')[0];
        const hour = dt.getUTCHours();
        existing.add(`${dateStr}T${String(hour).padStart(2, '0')}`);
      });
      setSelectedSlots(existing);
      setSubmitted(true);
    }
  }, []);

  useEffect(() => {
    async function loadEvent() {
      const { data, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .single();

      if (fetchError || !data) {
        setError('Event not found');
        setLoading(false);
        return;
      }

      setEvent(data);
      setLoading(false);

      // Check if user has already submitted via session token
      const sessionToken = localStorage.getItem(`gm_session_${data.id}`);
      if (sessionToken) {
        const { data: participant } = await supabase
          .from('participants')
          .select('*')
          .eq('event_id', data.id)
          .eq('session_token', sessionToken)
          .single();

        if (participant) {
          setName(participant.name);
          setEmail(participant.email || '');
          setExistingParticipantId(participant.id);
          loadExistingAvailability(data.id, participant.id);
        }
      }
    }

    loadEvent();
  }, [slug, loadExistingAvailability]);

  async function handleSubmit() {
    if (!event) return;
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (selectedSlots.size === 0) {
      setError('Please select at least one time slot');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      let participantId = existingParticipantId;
      let sessionToken = localStorage.getItem(`gm_session_${event.id}`);

      if (!participantId) {
        // Create new participant
        sessionToken = crypto.randomUUID();
        const { data: participant, error: pError } = await supabase
          .from('participants')
          .insert({
            event_id: event.id,
            name: name.trim(),
            email: email.trim() || null,
            session_token: sessionToken,
          })
          .select()
          .single();

        if (pError || !participant) throw new Error('Failed to save participant');
        participantId = participant.id;
        localStorage.setItem(`gm_session_${event.id}`, sessionToken);
      } else {
        // Update existing participant name/email
        await supabase
          .from('participants')
          .update({ name: name.trim(), email: email.trim() || null })
          .eq('id', participantId);

        // Delete old availability
        await supabase
          .from('availability')
          .delete()
          .eq('participant_id', participantId)
          .eq('event_id', event.id);
      }

      // Insert availability slots
      const slots = Array.from(selectedSlots).map((key) => {
        let slotStart: string;
        let slotEnd: string;

        if (event.granularity === 'daily') {
          slotStart = new Date(key + 'T00:00:00Z').toISOString();
          slotEnd = new Date(key + 'T23:59:59Z').toISOString();
        } else {
          const [date, hourStr] = key.split('T');
          const hour = parseInt(hourStr);
          slotStart = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00Z`).toISOString();
          slotEnd = new Date(`${date}T${String(hour + 1).padStart(2, '0')}:00:00Z`).toISOString();
        }

        return {
          participant_id: participantId!,
          event_id: event.id,
          slot_start: slotStart,
          slot_end: slotEnd,
        };
      });

      const { error: aError } = await supabase.from('availability').insert(slots);
      if (aError) throw new Error('Failed to save availability');

      // Notify organizer
      if (event.organizer_email) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'new_response',
            eventId: event.id,
            participantName: name.trim(),
          }),
        }).catch(() => {});
      }

      setExistingParticipantId(participantId);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

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

  return (
    <main className="min-h-screen pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">{event.name}</h1>
        {event.description && (
          <p className="text-sm text-gray-500 mt-1">{event.description}</p>
        )}
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto">
        {/* Name input */}
        <div className="mb-4">
          <label htmlFor="participant-name" className="block text-sm font-medium text-gray-700 mb-1">
            Your Name *
          </label>
          <input
            id="participant-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
            disabled={submitting}
          />
        </div>

        {/* Instructions */}
        <div className="mb-4 bg-indigo-50 rounded-xl px-4 py-3">
          <p className="text-sm text-indigo-700">
            {event.granularity === 'daily'
              ? 'Tap the days you\'re available'
              : 'Tap or drag to select the times you\'re available'}
          </p>
        </div>

        {/* Grid */}
        <div className="mb-4">
          <AvailabilityGrid
            dateStart={event.date_range_start}
            dateEnd={event.date_range_end}
            granularity={event.granularity as 'hourly' | 'daily'}
            timeStart={event.time_start ?? 8}
            timeEnd={event.time_end ?? 22}
            selectedSlots={selectedSlots}
            onSlotsChange={setSelectedSlots}
          />
        </div>

        {/* Email (optional) */}
        <div className="mb-4">
          <label htmlFor="participant-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email (optional)
          </label>
          <input
            id="participant-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Get notified when a time is chosen"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
            disabled={submitting}
          />
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3 mb-4">{error}</div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl text-base transition-colors disabled:opacity-50"
        >
          {submitting
            ? 'Saving...'
            : submitted
              ? 'Update Availability'
              : 'Submit Availability'}
        </button>

        {submitted && (
          <div className="mt-4 text-center">
            <a
              href={`/event/${slug}/results`}
              className="text-indigo-500 font-medium text-sm hover:text-indigo-600"
            >
              View Group Results →
            </a>
          </div>
        )}

        {/* Selected count */}
        <p className="text-center text-xs text-gray-400 mt-4">
          {selectedSlots.size} time{selectedSlots.size !== 1 ? 's' : ''} selected
        </p>
      </div>
    </main>
  );
}
