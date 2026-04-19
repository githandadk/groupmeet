'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { Poll, PollOption, PollVote } from '@/types/database';

type PublicPoll = Pick<Poll, 'id' | 'slug' | 'title' | 'description' | 'closed' | 'created_at'>;

export default function PollParticipantPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [poll, setPoll] = useState<PublicPoll | null>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [votes, setVotes] = useState<PollVote[]>([]);
  const [voterName, setVoterName] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');

  // Restore name from local storage so re-vote is easy
  useEffect(() => {
    const saved = localStorage.getItem(`gt_poll_voter_${slug}`);
    if (saved) setVoterName(saved);
  }, [slug]);

  const loadAll = useCallback(async () => {
    const { data: pollData, error: pollError } = await supabase
      .from('polls')
      .select('id, slug, title, description, closed, created_at')
      .eq('slug', slug)
      .single();
    if (pollError || !pollData) {
      setError('Poll not found');
      setLoading(false);
      return;
    }
    setPoll(pollData as PublicPoll);

    const { data: optionsData } = await supabase
      .from('poll_options').select('*').eq('poll_id', pollData.id).order('position');
    setOptions(optionsData || []);

    const { data: votesData } = await supabase
      .from('poll_votes')
      .select('id, poll_id, option_id, voter_name, voter_key, created_at')
      .eq('poll_id', pollData.id);
    setVotes(votesData || []);

    setLoading(false);
  }, [slug]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime updates on poll_votes
  useEffect(() => {
    if (!poll) return;
    const sub = supabase
      .channel(`poll-${poll.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${poll.id}` },
        async () => {
          const { data } = await supabase
            .from('poll_votes')
            .select('id, poll_id, option_id, voter_name, voter_key, created_at')
            .eq('poll_id', poll.id);
          if (data) setVotes(data as PollVote[]);
        }
      ).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [poll]);

  // Group votes by option
  const votesByOption = useMemo(() => {
    const m = new Map<string, PollVote[]>();
    for (const v of votes) {
      const list = m.get(v.option_id);
      if (list) list.push(v); else m.set(v.option_id, [v]);
    }
    return m;
  }, [votes]);

  // Detect existing vote by current voter name (case-insensitive)
  const myExistingVote = useMemo(() => {
    if (!voterName.trim()) return null;
    const key = voterName.trim().toLowerCase();
    return votes.find((v) => v.voter_key === key) || null;
  }, [votes, voterName]);

  // Default the selected option to existing vote on load
  useEffect(() => {
    if (myExistingVote && selectedOption === null) {
      setSelectedOption(myExistingVote.option_id);
    }
  }, [myExistingVote, selectedOption]);

  async function handleVote() {
    if (!poll || !selectedOption || !voterName.trim()) return;
    if (poll.closed) { setSubmitMessage('This poll is closed.'); return; }
    setSubmitting(true);
    setSubmitMessage('');
    try {
      const res = await fetch('/api/polls/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pollSlug: slug,
          optionId: selectedOption,
          voterName: voterName.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to vote');
      }
      localStorage.setItem(`gt_poll_voter_${slug}`, voterName.trim());
      setSubmitMessage(myExistingVote ? 'Vote updated!' : 'Vote submitted!');
    } catch (err) {
      setSubmitMessage(err instanceof Error ? err.message : 'Failed to vote');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (<main className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading...</p></main>);
  }
  if (error || !poll) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{error || 'Not found'}</p>
          <a href="/" className="text-indigo-500 hover:text-indigo-600 font-medium">Go Home</a>
        </div>
      </main>
    );
  }

  const totalVotes = votes.length;

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <a href="/" className="text-sm text-gray-400 hover:text-indigo-500 transition-colors">Group Tools</a>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{poll.title}</h1>
          {poll.description && (<p className="text-gray-500 mt-2 text-sm whitespace-pre-line">{poll.description}</p>)}
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-xs text-gray-400">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
            {poll.closed ? (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">Closed</span>
            ) : (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />Live
              </span>
            )}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
          <input type="text" value={voterName} onChange={(e) => setVoterName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
            maxLength={60} disabled={submitting || poll.closed} />
        </div>

        <div className="space-y-3 mb-4">
          {options.map((o) => {
            const optVotes = votesByOption.get(o.id) || [];
            const pct = totalVotes > 0 ? Math.round((optVotes.length / totalVotes) * 100) : 0;
            const isSelected = selectedOption === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => !poll.closed && setSelectedOption(o.id)}
                disabled={poll.closed}
                className={`w-full text-left rounded-xl border p-4 transition-colors relative overflow-hidden ${
                  isSelected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200 bg-white hover:border-indigo-300'
                } ${poll.closed ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className="absolute inset-y-0 left-0 bg-indigo-50" style={{ width: `${pct}%` }} aria-hidden />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                      isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 bg-white'
                    }`}>
                      {isSelected && (<div className="w-1.5 h-1.5 bg-white rounded-full m-auto mt-[5px]" />)}
                    </div>
                    <span className="font-medium text-gray-900 truncate">{o.label}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-gray-900">{optVotes.length}</div>
                    <div className="text-xs text-gray-400">{pct}%</div>
                  </div>
                </div>
                {optVotes.length > 0 && (
                  <div className="relative mt-2 flex flex-wrap gap-1.5">
                    {optVotes.map((v) => (
                      <span key={v.id} className={`text-xs px-2 py-0.5 rounded-full ${
                        v.voter_key === voterName.trim().toLowerCase()
                          ? 'bg-indigo-100 text-indigo-700 font-medium' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {v.voter_name}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <button onClick={handleVote}
          disabled={!selectedOption || !voterName.trim() || submitting || poll.closed}
          className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? 'Saving...' : myExistingVote ? 'Change Vote' : 'Submit Vote'}
        </button>
        {submitMessage && (
          <p className="text-center text-sm text-gray-500 mt-3">{submitMessage}</p>
        )}
      </div>
    </main>
  );
}
