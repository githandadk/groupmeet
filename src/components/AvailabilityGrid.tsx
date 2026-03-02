'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { getDatesInRange, getTimeSlots, formatDate, formatMinutes, slotKey, parseSlotKey, granularityStepMinutes } from '@/lib/utils';

interface AvailabilityGridProps {
  dateStart: string;
  dateEnd: string;
  granularity: string;
  timeStart: number;
  timeEnd: number;
  selectedSlots: Set<string>;
  onSlotsChange: (slots: Set<string>) => void;
  readOnly?: boolean;
}

export default function AvailabilityGrid({
  dateStart,
  dateEnd,
  granularity,
  timeStart,
  timeEnd,
  selectedSlots,
  onSlotsChange,
  readOnly = false,
}: AvailabilityGridProps) {
  const dates = useMemo(() => getDatesInRange(dateStart, dateEnd), [dateStart, dateEnd]);
  const step = granularityStepMinutes(granularity);
  const timeSlots = useMemo(
    () => (granularity !== 'daily' ? getTimeSlots(timeStart, timeEnd, step) : []),
    [granularity, timeStart, timeEnd, step]
  );

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectMode, setSelectMode] = useState<'add' | 'remove'>('add');
  const [draggedCells, setDraggedCells] = useState<Set<string>>(new Set());
  const gridRef = useRef<HTMLDivElement>(null);
  const startCellRef = useRef<string | null>(null);

  // For horizontal scrolling on mobile - show 3 days at a time
  const [dayOffset, setDayOffset] = useState(0);
  const visibleDays = Math.min(dates.length, 3);
  const visibleDates = dates.slice(dayOffset, dayOffset + visibleDays);
  const canScrollLeft = dayOffset > 0;
  const canScrollRight = dayOffset + visibleDays < dates.length;

  const getCellFromPoint = useCallback(
    (x: number, y: number): string | null => {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const cell = (el as HTMLElement).closest('[data-slot]');
      if (!cell) return null;
      return (cell as HTMLElement).dataset.slot || null;
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, key: string) => {
      if (readOnly) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const mode = selectedSlots.has(key) ? 'remove' : 'add';
      setSelectMode(mode);
      setIsSelecting(true);
      startCellRef.current = key;
      setDraggedCells(new Set([key]));
    },
    [selectedSlots, readOnly]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isSelecting || readOnly) return;
      e.preventDefault();

      const key = getCellFromPoint(e.clientX, e.clientY);
      if (key && startCellRef.current) {
        const startKey = startCellRef.current;
        const newDragged = new Set<string>();

        if (granularity === 'daily') {
          const startIdx = dates.indexOf(startKey);
          const endIdx = dates.indexOf(key);
          if (startIdx !== -1 && endIdx !== -1) {
            const lo = Math.min(startIdx, endIdx);
            const hi = Math.max(startIdx, endIdx);
            for (let i = lo; i <= hi; i++) {
              newDragged.add(dates[i]);
            }
          }
        } else {
          const startParsed = parseSlotKey(startKey);
          const endParsed = parseSlotKey(key);
          const startDayIdx = dates.indexOf(startParsed.date);
          const endDayIdx = dates.indexOf(endParsed.date);

          if (startDayIdx !== -1 && endDayIdx !== -1) {
            const loDay = Math.min(startDayIdx, endDayIdx);
            const hiDay = Math.max(startDayIdx, endDayIdx);
            const loSlotIdx = Math.min(
              timeSlots.indexOf(startParsed.minutes),
              timeSlots.indexOf(endParsed.minutes)
            );
            const hiSlotIdx = Math.max(
              timeSlots.indexOf(startParsed.minutes),
              timeSlots.indexOf(endParsed.minutes)
            );

            if (loSlotIdx !== -1 && hiSlotIdx !== -1) {
              for (let d = loDay; d <= hiDay; d++) {
                for (let s = loSlotIdx; s <= hiSlotIdx; s++) {
                  newDragged.add(slotKey(dates[d], timeSlots[s]));
                }
              }
            }
          }
        }

        setDraggedCells(newDragged);
      }
    },
    [isSelecting, readOnly, getCellFromPoint, dates, granularity, timeSlots]
  );

  const handlePointerUp = useCallback(() => {
    if (!isSelecting || readOnly) return;
    setIsSelecting(false);

    const newSlots = new Set(selectedSlots);
    draggedCells.forEach((key) => {
      if (selectMode === 'add') {
        newSlots.add(key);
      } else {
        newSlots.delete(key);
      }
    });
    onSlotsChange(newSlots);
    setDraggedCells(new Set());
    startCellRef.current = null;
  }, [isSelecting, readOnly, selectedSlots, draggedCells, selectMode, onSlotsChange]);

  useEffect(() => {
    const handleGlobalUp = () => {
      if (isSelecting) {
        handlePointerUp();
      }
    };
    window.addEventListener('pointerup', handleGlobalUp);
    return () => window.removeEventListener('pointerup', handleGlobalUp);
  }, [isSelecting, handlePointerUp]);

  function isCellSelected(key: string): boolean {
    const inDrag = draggedCells.has(key);
    const inSelected = selectedSlots.has(key);

    if (!isSelecting) return inSelected;
    if (inDrag) return selectMode === 'add';
    return inSelected;
  }

  if (granularity === 'daily') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {dates.map((date) => {
            const key = slotKey(date);
            const selected = isCellSelected(key);
            return (
              <button
                key={date}
                data-slot={key}
                type="button"
                onPointerDown={(e) => handlePointerDown(e, key)}
                onPointerMove={handlePointerMove}
                className={`py-4 px-2 rounded-xl text-sm font-medium transition-colors select-none ${
                  selected
                    ? 'bg-indigo-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:border-indigo-300'
                } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                style={{ touchAction: 'none', userSelect: 'none' }}
              >
                {formatDate(date)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const cellHeight = step === 30 ? 'h-8' : 'h-12';
  const cellMinHeight = step === 30 ? '32px' : '48px';

  return (
    <div className="space-y-2">
      {/* Day navigation */}
      {dates.length > 3 && (
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => setDayOffset(Math.max(0, dayOffset - 1))}
            disabled={!canScrollLeft}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm text-gray-500">
            {formatDate(visibleDates[0])} — {formatDate(visibleDates[visibleDates.length - 1])}
          </span>
          <button
            type="button"
            onClick={() => setDayOffset(Math.min(dates.length - visibleDays, dayOffset + 1))}
            disabled={!canScrollRight}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Day strip indicators */}
      {dates.length > 3 && (
        <div className="flex gap-1 justify-center mb-2">
          {dates.map((date, i) => {
            const isVisible = i >= dayOffset && i < dayOffset + visibleDays;
            const hasSelection = timeSlots.some((m) => selectedSlots.has(slotKey(date, m)));
            return (
              <button
                key={date}
                type="button"
                onClick={() => setDayOffset(Math.min(dates.length - visibleDays, Math.max(0, i - 1)))}
                className={`h-2 rounded-full transition-all ${
                  isVisible ? 'w-6 bg-indigo-500' : hasSelection ? 'w-2 bg-indigo-300' : 'w-2 bg-gray-300'
                }`}
              />
            );
          })}
        </div>
      )}

      {/* Grid */}
      <div
        ref={gridRef}
        className="grid select-none"
        style={{
          gridTemplateColumns: `56px repeat(${visibleDates.length}, 1fr)`,
          touchAction: 'none',
          userSelect: 'none',
        }}
        onPointerMove={handlePointerMove}
      >
        {/* Header row */}
        <div className="h-12" />
        {visibleDates.map((date) => (
          <div key={date} className="h-12 flex flex-col items-center justify-center text-xs">
            <span className="font-medium text-gray-900">
              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
            </span>
            <span className="text-gray-500">
              {new Date(date + 'T00:00:00').getDate()}
            </span>
          </div>
        ))}

        {/* Time rows */}
        {timeSlots.map((mins) => {
          const key_prefix = mins;
          const isHourBoundary = mins % 60 === 0;
          return (
            <>
              <div
                key={`label-${key_prefix}`}
                className={`${cellHeight} flex items-center justify-end pr-2 text-xs text-gray-400`}
              >
                {isHourBoundary || step >= 60 ? formatMinutes(mins) : ''}
              </div>
              {visibleDates.map((date) => {
                const key = slotKey(date, mins);
                const selected = isCellSelected(key);
                return (
                  <div
                    key={key}
                    data-slot={key}
                    onPointerDown={(e) => handlePointerDown(e, key)}
                    className={`${cellHeight} border border-gray-100 transition-colors ${
                      isHourBoundary ? 'border-t-gray-200' : ''
                    } ${
                      selected ? 'bg-indigo-500' : 'bg-white hover:bg-indigo-50'
                    } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                    style={{ touchAction: 'none', userSelect: 'none', minHeight: cellMinHeight }}
                  />
                );
              })}
            </>
          );
        })}
      </div>
    </div>
  );
}
