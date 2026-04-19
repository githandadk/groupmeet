'use client';

import { useMemo } from 'react';
import type { SignupItem, SignupClaim } from '@/types/database';
import { formatDate } from '@/lib/utils';

interface SignupItemListProps {
  items: SignupItem[];
  claims: SignupClaim[];
  sessionToken: string | null;
  participantName: string;
  onClaim: (itemId: string) => void;
  onUnclaim: (claimId: string) => void;
  claiming: string | null;
  isAdmin?: boolean;
  onAdminRemove?: (claimId: string) => void;
}

function ItemCard({
  item, itemClaims, sessionToken, participantName, onClaim, onUnclaim, claiming, isAdmin, onAdminRemove,
}: {
  item: SignupItem;
  itemClaims: SignupClaim[];
  sessionToken: string | null;
  participantName: string;
  onClaim: (itemId: string) => void;
  onUnclaim: (claimId: string) => void;
  claiming: string | null;
  isAdmin?: boolean;
  onAdminRemove?: (claimId: string) => void;
}) {
  const isFull = itemClaims.length >= item.capacity;
  const myClaim = sessionToken ? itemClaims.find((c) => c.session_token === sessionToken) : null;
  const spotsLeft = item.capacity - itemClaims.length;

  return (
    <div className={`rounded-xl border p-4 transition-colors ${isFull ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-gray-900">{item.label}</h3>
          {item.description && (<p className="text-sm text-gray-500 mt-0.5">{item.description}</p>)}
        </div>
        <div className="flex-shrink-0">
          {myClaim ? (
            <button onClick={() => onUnclaim(myClaim.id)} disabled={claiming === item.id}
              className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50">
              Remove
            </button>
          ) : !isFull && sessionToken && participantName.trim() ? (
            <button onClick={() => onClaim(item.id)} disabled={claiming === item.id}
              className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors disabled:opacity-50">
              {claiming === item.id ? 'Signing up...' : 'Sign Up'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${isFull ? 'bg-gray-400' : 'bg-indigo-500'}`}
              style={{ width: `${Math.min(100, (itemClaims.length / item.capacity) * 100)}%` }} />
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {isFull ? 'Full' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
          </span>
        </div>
      </div>

      {itemClaims.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {itemClaims.map((claim) => (
            <span key={claim.id}
              className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                claim.session_token === sessionToken ? 'bg-indigo-100 text-indigo-700 font-medium' : 'bg-gray-100 text-gray-600'
              }`}>
              {claim.participant_name}
              {isAdmin && onAdminRemove && (
                <button onClick={() => onAdminRemove(claim.id)} className="text-gray-400 hover:text-red-500 ml-0.5" title="Remove this person">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SignupItemList({
  items, claims, sessionToken, participantName, onClaim, onUnclaim, claiming, isAdmin, onAdminRemove,
}: SignupItemListProps) {
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.sort_order - b.sort_order),
    [items]
  );

  const claimsByItem = useMemo(() => {
    const m = new Map<string, SignupClaim[]>();
    for (const c of claims) {
      const list = m.get(c.item_id);
      if (list) list.push(c); else m.set(c.item_id, [c]);
    }
    return m;
  }, [claims]);

  const grouped = useMemo(() => {
    const hasDates = sortedItems.some((item) => item.date);
    if (!hasDates) return null;
    const map = new Map<string, SignupItem[]>();
    for (const item of sortedItems) {
      const key = item.date || '_undated';
      const list = map.get(key);
      if (list) list.push(item); else map.set(key, [item]);
    }
    const dateKeys = Array.from(map.keys()).sort();
    return { map, dateKeys };
  }, [sortedItems]);

  if (grouped) {
    return (
      <div className="space-y-6">
        {grouped.dateKeys.map((dateKey) => (
          <div key={dateKey}>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 px-1">
              {dateKey === '_undated' ? 'Other' : formatDate(dateKey)}
            </h3>
            <div className="space-y-3">
              {grouped.map.get(dateKey)!.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  itemClaims={claimsByItem.get(item.id) || []}
                  sessionToken={sessionToken}
                  participantName={participantName}
                  onClaim={onClaim}
                  onUnclaim={onUnclaim}
                  claiming={claiming}
                  isAdmin={isAdmin}
                  onAdminRemove={onAdminRemove}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedItems.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          itemClaims={claimsByItem.get(item.id) || []}
          sessionToken={sessionToken}
          participantName={participantName}
          onClaim={onClaim}
          onUnclaim={onUnclaim}
          claiming={claiming}
          isAdmin={isAdmin}
          onAdminRemove={onAdminRemove}
        />
      ))}
    </div>
  );
}
