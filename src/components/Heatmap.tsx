'use client';

import { useMemo } from 'react';
import { getDatesInRange, getTimeSlots, formatDate, formatMinutes, slotKey, granularityStepMinutes, utcToWallClock, getTimezoneAbbr } from '@/lib/utils';
import type { Event, Availability, Participant } from '@/types/database';

interface HeatmapProps {
  event: Omit<Event, 'admin_token'>;
  availability: Availability[];
  participants: Participant[];
  onSelectSlot?: (slotStart: string, slotEnd: string) => void;
}

interface SlotInfo {
  key: string;
  slotStart: string;
  slotEnd: string;
  count: number;
  names: string[];
}

export default function Heatmap({ event, availability, participants, onSelectSlot }: HeatmapProps) {
  const dates = getDatesInRange(event.date_range_start, event.date_range_end);
  const step = granularityStepMinutes(event.granularity);
  const timeSlots = event.granularity !== 'daily'
    ? getTimeSlots(event.time_start ?? 8, event.time_end ?? 22, step)
    : [];
  const totalParticipants = participants.length;

  const participantMap = useMemo(() => {
    const map: Record<string, string> = {};
    participants.forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [participants]);

  const slotData = useMemo(() => {
    const data: Record<string, SlotInfo> = {};

    availability.forEach((a) => {
      let key: string;

      if (event.granularity === 'daily') {
        const dt = new Date(a.slot_start);
        key = dt.toISOString().split('T')[0];
      } else {
        const wc = utcToWallClock(a.slot_start, event.timezone);
        key = slotKey(wc.date, wc.minutes);
      }

      if (!data[key]) {
        data[key] = {
          key,
          slotStart: a.slot_start,
          slotEnd: a.slot_end,
          count: 0,
          names: [],
        };
      }
      data[key].count++;
      const name = a.participant_id ? participantMap[a.participant_id] : undefined;
      if (name && !data[key].names.includes(name)) {
        data[key].names.push(name);
      }
    });

    return data;
  }, [availability, event.granularity, event.timezone, participantMap]);

  const rankedSlots = useMemo(() => {
    return Object.values(slotData)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [slotData]);

  function getCellColor(count: number): string {
    if (count === 0 || totalParticipants === 0) return 'bg-gray-50';
    const ratio = count / totalParticipants;
    if (ratio >= 1) return 'bg-green-500';
    if (ratio >= 0.75) return 'bg-green-400';
    if (ratio >= 0.5) return 'bg-yellow-400';
    if (ratio >= 0.25) return 'bg-yellow-300';
    return 'bg-yellow-200';
  }

  function getTextColor(count: number): string {
    if (count === 0 || totalParticipants === 0) return 'text-gray-300';
    const ratio = count / totalParticipants;
    if (ratio >= 0.5) return 'text-white';
    return 'text-gray-700';
  }

  function formatSlotTime(slotStart: string, _slotEnd: string): string {
    if (event.granularity === 'daily') {
      const start = new Date(slotStart);
      return formatDate(start.toISOString().split('T')[0]);
    }
    const wc = utcToWallClock(slotStart, event.timezone);
    const day = formatDate(wc.date);
    const time = formatMinutes(wc.minutes);
    return `${day} ${time}`;
  }

  if (event.granularity === 'daily') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {dates.map((date) => {
            const key = date;
            const info = slotData[key];
            const count = info?.count || 0;
            return (
              <div
                key={date}
                onClick={() => info && onSelectSlot?.(info.slotStart, info.slotEnd)}
                className={`py-4 px-2 rounded-xl text-center transition-colors ${getCellColor(count)} ${
                  onSelectSlot && count > 0 ? 'cursor-pointer hover:ring-2 hover:ring-indigo-400' : ''
                }`}
              >
                <div className={`text-sm font-medium ${getTextColor(count)}`}>
                  {formatDate(date)}
                </div>
                <div className={`text-xs mt-1 ${getTextColor(count)}`}>
                  {count}/{totalParticipants}
                </div>
              </div>
            );
          })}
        </div>

        <RankedCards
          rankedSlots={rankedSlots}
          totalParticipants={totalParticipants}
          formatSlotTime={formatSlotTime}
          onSelectSlot={onSelectSlot}
        />
      </div>
    );
  }

  const cellHeight = step === 30 ? 'h-8' : 'h-10';

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-400 text-right">
        {getTimezoneAbbr(event.timezone)}
      </p>
      <div className="overflow-x-auto -mx-4 px-4">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `56px repeat(${dates.length}, minmax(60px, 1fr))`,
          }}
        >
          {/* Header */}
          <div className="h-12" />
          {dates.map((date) => (
            <div key={date} className="h-12 flex flex-col items-center justify-center text-xs">
              <span className="font-medium text-gray-900">
                {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
              <span className="text-gray-500">
                {new Date(date + 'T00:00:00').getDate()}
              </span>
            </div>
          ))}

          {/* Rows */}
          {timeSlots.map((mins) => {
            const isHourBoundary = mins % 60 === 0;
            return (
              <>
                <div key={`label-${mins}`} className={`${cellHeight} flex items-center justify-end pr-2 text-xs text-gray-400`}>
                  {isHourBoundary || step >= 60 ? formatMinutes(mins) : ''}
                </div>
                {dates.map((date) => {
                  const key = slotKey(date, mins);
                  const info = slotData[key];
                  const count = info?.count || 0;
                  return (
                    <div
                      key={key}
                      onClick={() => info && onSelectSlot?.(info.slotStart, info.slotEnd)}
                      className={`${cellHeight} border border-gray-100 ${
                        isHourBoundary ? 'border-t-gray-200' : ''
                      } flex items-center justify-center text-xs font-medium transition-colors ${getCellColor(count)} ${getTextColor(count)} ${
                        onSelectSlot && count > 0 ? 'cursor-pointer hover:ring-1 hover:ring-indigo-400' : ''
                      }`}
                      title={info ? `${count}/${totalParticipants}: ${info.names.join(', ')}` : 'No one available'}
                    >
                      {count > 0 ? count : ''}
                    </div>
                  );
                })}
              </>
            );
          })}
        </div>
      </div>

      <RankedCards
        rankedSlots={rankedSlots}
        totalParticipants={totalParticipants}
        formatSlotTime={formatSlotTime}
        onSelectSlot={onSelectSlot}
      />
    </div>
  );
}

function RankedCards({
  rankedSlots,
  totalParticipants,
  formatSlotTime,
  onSelectSlot,
}: {
  rankedSlots: SlotInfo[];
  totalParticipants: number;
  formatSlotTime: (start: string, end: string) => string;
  onSelectSlot?: (slotStart: string, slotEnd: string) => void;
}) {
  if (rankedSlots.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 text-sm">No responses yet. Share the link!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700">Best Times</h3>
      {rankedSlots.map((slot, i) => (
        <div
          key={slot.key}
          onClick={() => onSelectSlot?.(slot.slotStart, slot.slotEnd)}
          className={`bg-white rounded-xl border border-gray-200 p-4 ${
            onSelectSlot ? 'cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                {i === 0 && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    Best
                  </span>
                )}
                <span className="font-medium text-gray-900">
                  {formatSlotTime(slot.slotStart, slot.slotEnd)}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {slot.names.join(', ')}
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-gray-900">
                {slot.count}/{totalParticipants}
              </div>
              <div className="text-xs text-gray-400">available</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
