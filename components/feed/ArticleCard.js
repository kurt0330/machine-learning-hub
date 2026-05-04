'use client';
// ── Article Card ───────────────────────────────────────────
// One article in the feed. Shows author info, title,
// description preview, like count, and share button.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { getDisplayName, getInitials, timeAgo, truncate, formatCount } from '../../lib/helpers';

export default function ArticleCard({
  article,
  rank,
  isLiked,
  currentUserId,
  onLikeToggle,
}) {
  const [author, setAuthor]           = useState(null);
  const [likeLoading, setLikeLoading] = useState(false);
  const [shareMsg,    setShareMsg]    = useState('');

  // ── FIX: Convert relative image path to Supabase Public URL ──
  let finalCoverUrl = article.cover_url;
  if (finalCoverUrl && !finalCoverUrl.startsWith('http')) {
    // Note: If your storage bucket is named "covers" instead of "articles", change 'articles' below to 'covers'
    const { data } = supabase.storage.from('articles').getPublicUrl(finalCoverUrl);
    finalCoverUrl = data.publicUrl;
  }
  // ─────────────────────────────────────────────────────────────

  // Fetch the profile separately because we bypassed the database join
  useEffect(() => {
    async function getAuthor() {
      if (!article.author_id) return;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', article.author_id)
        .single();
      
      if (data) setAuthor(data);
    }
    getAuthor();
  }, [article.author_id]);

  const displayName = getDisplayName(author) || "Loading...";
  const initials    = getInitials(displayName);
  const avatarUrl   = author?.avatar_url || null;

  // ── Like / Unlike ─────────────────────────────────────
  async function handleLike(e) {
    e.preventDefault();   // don't navigate to article
    e.stopPropagation();
    if (!currentUserId)  { return; }
    if (likeLoading)     { return; }

    setLikeLoading(true);
    const newLiked = !isLiked;
    const newCount = (article.likes_count ?? 0) + (newLiked ? 1 : -1);

    // Optimistic update
    onLikeToggle(article.id, newLiked, newCount);

    if (newLiked) {
      await supabase.from('likes').insert({ article_id: article.id, user_id: currentUserId });
    } else {
      await supabase.from('likes')
        .delete()
        .eq('article_id', article.id)
        .eq('user_id', currentUserId);
    }

    setLikeLoading(false);
  }

  // ── Share ──────────────────────────────────────────────
  async function handleShare(e) {
    e.preventDefault();
    e.stopPropagation();

    const url   = `${window.location.origin}/articles/${article.id}`;
    const title = article.title;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {}
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(url);
        setShareMsg('Link copied!');
        setTimeout(() => setShareMsg(''), 2000);
      } catch {
        setShareMsg('Could not copy link.');
        setTimeout(() => setShareMsg(''), 2000);
      }
    }
  }

  return (
    <Link
      href={`/articles/${article.id}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div
        className="card card--interactive"
        style={{ padding: 'var(--space-5)', position: 'relative' }}
      >

        {/* ── Rank badge (Top 5 only) ─────────────────── */}
        {rank && (
          <div style={{
            position:       'absolute',
            top:            'var(--space-4)',
            right:          'var(--space-4)',
            width:          '28px',
            height:         '28px',
            borderRadius:   'var(--radius-full)',
            background:     rank === 1
              ? 'linear-gradient(135deg, #f59e0b, #d97706)'
              : 'var(--color-bg-overlay)',
            border:         '1px solid var(--color-border-default)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       'var(--text-xs)',
            fontWeight:     'var(--weight-bold)',
            color:          rank === 1
              ? '#000'
              : 'var(--color-text-muted)',
          }}>
            {rank}
          </div>
        )}

        {/* ── Cover image ────────────────────────────── */}
        {finalCoverUrl && (
          <div style={{
            width:        '100%',
            height:       '160px',
            borderRadius: 'var(--radius-md)',
            overflow:     'hidden',
            marginBottom: 'var(--space-4)',
            background:   'var(--color-bg-overlay)',
          }}>
            <img
              src={finalCoverUrl}
              alt={article.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        {/* ── Author row ─────────────────────────────── */}
        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          'var(--space-3)',
          marginBottom: 'var(--space-4)',
        }}>
          {/* Avatar */}
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="avatar avatar--sm" />
          ) : (
            <div
              className="avatar avatar--sm"
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                background:     'var(--color-bg-overlay)',
                fontSize:       'var(--text-xs)',
                fontWeight:     'var(--weight-semibold)',
                color:          'var(--color-text-secondary)',
              }}
            >
              {initials}
            </div>
          )}

          {/* Name + time */}
          <div>
            <p style={{
              fontSize:   'var(--text-sm)',
              fontWeight: 'var(--weight-medium)',
              color:      'var(--color-text-primary)',
              lineHeight: 1.2,
            }}>
              {displayName}
            </p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {timeAgo(article.created_at)}
            </p>
          </div>
        </div>

        {/* ── Title ──────────────────────────────────── */}
        <h3 style={{
          fontSize:     'var(--text-md)',
          fontWeight:   'var(--weight-semibold)',
          color:        'var(--color-text-primary)',
          lineHeight:   'var(--leading-snug)',
          marginBottom: article.description ? 'var(--space-2)' : 'var(--space-4)',
        }}>
          {article.title}
        </h3>

        {/* ── Description preview ────────────────────── */}
        {article.description && (
          <p style={{
            fontSize:     'var(--text-sm)',
            color:        'var(--color-text-secondary)',
            lineHeight:   'var(--leading-normal)',
            marginBottom: 'var(--space-4)',
          }}>
            {truncate(article.description, 120)}
          </p>
        )}

        {/* ── Footer: actions ─────────────────────────── */}
        <div style={{
          display:     'flex',
          alignItems:  'center',
          gap:         'var(--space-3)',
          paddingTop:  'var(--space-4)',
          borderTop:   '1px solid var(--color-border-subtle)',
        }}>

          {/* Like button */}
          <button
            onClick={handleLike}
            disabled={likeLoading || !currentUserId}
            className={`like-btn ${isLiked ? 'like-btn--active' : ''}`}
            title={currentUserId ? (isLiked ? 'Unlike' : 'Like') : 'Log in to like'}
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24"
              fill={isLiked ? 'currentColor' : 'none'}
              stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {formatCount(article.likes_count ?? 0)}
          </button>

          {/* Comment count (read-only, links to article) */}
          <span style={{
            display:    'inline-flex',
            alignItems: 'center',
            gap:        'var(--space-2)',
            fontSize:   'var(--text-sm)',
            color:      'var(--color-text-muted)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Comment
          </span>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Share button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={handleShare}
              className="btn btn--ghost btn--sm"
              title="Share article"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5"  r="3"/>
                <circle cx="6"  cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59"  y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51"  x2="8.59"  y2="10.49"/>
              </svg>
              Share
            </button>
            {shareMsg && (
              <div style={{
                position:     'absolute',
                bottom:       'calc(100% + var(--space-2))',
                right:        0,
                background:   'var(--color-bg-overlay)',
                border:       '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-sm)',
                padding:      'var(--space-2) var(--space-3)',
                fontSize:     'var(--text-xs)',
                color:        'var(--color-text-primary)',
                whiteSpace:   'nowrap',
                boxShadow:    'var(--shadow-md)',
                zIndex:       10,
              }}>
                {shareMsg}
              </div>
            )}
          </div>

          {/* Read arrow */}
          <span style={{
            fontSize: 'var(--text-xs)',
            color:    'var(--color-text-muted)',
          }}>
            Read →
          </span>

        </div>
      </div>
    </Link>
  );
}