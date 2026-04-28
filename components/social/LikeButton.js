'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCount } from '../../lib/helpers';

export default function LikeButton({
  articleId,
  initialLiked = false,
  initialCount = 0,
  currentUserId,
  onToggle,
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [burst, setBurst] = useState(false);

  // ── 1. Realtime Subscription ──────────────────────────────
  // This listens for any changes in the 'likes' table for this article
  useEffect(() => {
    if (!articleId) return;

    const channel = supabase
      .channel(`likes-realtime-${articleId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT and DELETE
          schema: 'public',
          table: 'likes',
          filter: `article_id=eq.${articleId}`
        },
        async () => {
          // When a change is detected, fetch the exact count from the DB
          const { count: dbCount, error } = await supabase
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .eq('article_id', articleId);

          if (!error && dbCount !== null) {
            setCount(dbCount);
            onToggle?.(liked, dbCount);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [articleId, liked, onToggle]);

  // ── 2. Click Handler (Optimistic Update) ──────────────────
  async function handleToggle() {
    if (!currentUserId || loading) return;

    setLoading(true);
    const newLiked = !liked;
    
    // Snappy UI: update local state immediately
    setLiked(newLiked);
    if (newLiked) {
      setBurst(true);
      setTimeout(() => setBurst(false), 600);
    }

    if (newLiked) {
      // Add a like record
      const { error } = await supabase
        .from('likes')
        .insert({ 
          article_id: articleId, 
          user_id: currentUserId // Verified matching column name
        });

      if (error) {
        setLiked(!newLiked); // Rollback if database insert fails
        console.error("Error liking:", error.message);
      }
    } else {
      // Remove a like record
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('article_id', articleId)
        .eq('user_id', currentUserId);

      if (error) {
        setLiked(!newLiked); // Rollback if database delete fails
        console.error("Error unliking:", error.message);
      }
    }

    setLoading(false);
  }

  const isGuest = !currentUserId;

  return (
    <button
      onClick={handleToggle}
      disabled={loading || isGuest}
      className={`like-btn ${liked ? 'like-btn--active' : ''}`}
      title={isGuest ? 'Log in to like' : liked ? 'Remove like' : 'Like'}
      style={{
        transform:  burst ? 'scale(1.25)' : 'scale(1)',
        transition: `transform ${burst ? '150ms' : '300ms'} cubic-bezier(0.34,1.56,0.64,1),
                     background var(--transition-fast),
                     border-color var(--transition-fast),
                     color var(--transition-fast)`,
        position:   'relative',
        overflow:   'visible',
        opacity:    isGuest ? 0.5 : 1,
        cursor:     isGuest ? 'not-allowed' : 'pointer',
      }}
      aria-label={`${count} likes`}
      aria-pressed={liked}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: 'fill var(--transition-fast)' }}
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>

      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatCount(count)}
      </span>

      {burst && (
        <span style={{
          position:     'absolute',
          inset:        '-4px',
          borderRadius: 'var(--radius-full)',
          border:       '2px solid var(--color-accent-red)',
          opacity:      0,
          animation:    'like-burst 0.5s ease forwards',
          pointerEvents:'none',
        }} />
      )}

      <style>{`
        @keyframes like-burst {
          0%   { opacity: 0.8; transform: scale(0.8); }
          100% { opacity: 0;   transform: scale(2);   }
        }
      `}</style>
    </button>
  );
}