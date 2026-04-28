'use client';
// ── Comment Section ────────────────────────────────────────
// Nested comments (top-level + one level of replies).
// Each comment shows avatar, name, timestamp, and body.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { getDisplayName, getInitials, timeAgo } from '../../lib/helpers';

export default function CommentSection({ articleId, currentUser }) {
  const [comments,    setComments]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [body,        setBody]        = useState('');
  const [replyTo,     setReplyTo]     = useState(null); // { id, authorName }
  const [replyBody,   setReplyBody]   = useState('');
  const [error,       setError]       = useState('');
  const [deletingId,  setDeletingId]  = useState(null);

  // ── Fetch all comments for this article ───────────────
  const fetchComments = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('comments')
      .select(`
        id, content, created_at, parent_id,
        profiles:user_id (
          id, username, full_name, avatar_url
        )
      `)
      .eq('article_id', articleId)
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('[CommentSection] fetch error:', fetchError.message);
      setLoading(false);
      return;
    }

    // Build tree: separate top-level comments and replies
    const topLevel = (data ?? []).filter(c => !c.parent_id);
    const replies  = (data ?? []).filter(c =>  c.parent_id);

    // Attach replies to their parents
    const tree = topLevel.map(comment => ({
      ...comment,
      replies: replies.filter(r => r.parent_id === comment.id),
    }));

    setComments(tree);
    setLoading(false);
  }, [articleId]);

  useEffect(() => {
    fetchComments();

    // Realtime updates — new comments appear instantly
    const channel = supabase
      .channel(`comments-${articleId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments',
          filter: `article_id=eq.${articleId}` },
        fetchComments
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'comments',
          filter: `article_id=eq.${articleId}` },
        fetchComments
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [articleId, fetchComments]);

  // ── Post a top-level comment ───────────────────────────
  async function handlePost() {
    if (!body.trim() || !currentUser) return;
    setError('');
    setSubmitting(true);

    const { error: postError } = await supabase
      .from('comments')
      .insert({
        article_id: articleId,
        user_id:  currentUser.id,
        content:  body.trim(),
        parent_id:  null,
      });

    setSubmitting(false);

    if (postError) {
      setError('Failed to post comment. Please try again.');
    } else {
      setBody('');

      fetchComments();
    }
    
  }

  // ── Post a reply ───────────────────────────────────────
  async function handleReply() {
    if (!replyBody.trim() || !currentUser || !replyTo) return;
    setError('');
    setSubmitting(true);

    const { error: replyError } = await supabase
      .from('comments')
      .insert({
        article_id: articleId,
        user_id:  currentUser.id,
        content:  replyBody.trim(),
        parent_id:  replyTo.id,
      });

    if (replyError) {
      setError('Failed to post reply. Please try again.');
    } else {
      setReplyTo(null);
      setReplyBody('');
    }
    setSubmitting(false);
  }

  // ── Delete a comment ───────────────────────────────────
  async function handleDelete(commentId) {
    if (!currentUser) return;
    setDeletingId(commentId);
    await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', currentUser.id);
    setDeletingId(null);
  }

  const totalCount = comments.reduce((sum, c) => sum + 1 + (c.replies?.length ?? 0), 0);

  return (
    <div className="card" style={{ padding: 'var(--space-6)' }}>

      {/* ── Header ──────────────────────────────────── */}
      <h2 style={{
        fontSize:     'var(--text-lg)',
        fontWeight:   'var(--weight-bold)',
        color:        'var(--color-text-primary)',
        marginBottom: 'var(--space-6)',
        display:      'flex',
        alignItems:   'center',
        gap:          'var(--space-3)',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: 'var(--color-text-muted)' }}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Discussion
        <span className="badge badge--neutral">{totalCount}</span>
      </h2>

      {/* ── Compose box ─────────────────────────────── */}
      {currentUser ? (
        <div style={{
          display:       'flex',
          gap:           'var(--space-3)',
          marginBottom:  'var(--space-6)',
          alignItems:    'flex-start',
        }}>
          <UserAvatar userId={currentUser.id} size="sm" />
          <div style={{ flex: 1 }}>
            <textarea
              className="form-input form-textarea"
              placeholder="Share your thoughts on this article…"
              value={body}
              onChange={e => setBody(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost();
              }}
              rows={3}
              style={{ resize: 'vertical', minHeight: '80px' }}
            />
            <div style={{
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'center',
              marginTop:      'var(--space-2)',
            }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                Ctrl+Enter to post
              </span>
              <button
                onClick={handlePost}
                disabled={submitting || !body.trim()}
                className="btn btn--primary btn--sm"
              >
                {submitting
                  ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Posting…</>
                  : 'Post Comment'
                }
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          padding:      'var(--space-4)',
          background:   'var(--color-bg-elevated)',
          borderRadius: 'var(--radius-md)',
          textAlign:    'center',
          marginBottom: 'var(--space-6)',
          border:       '1px dashed var(--color-border-default)',
        }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
            Join the discussion
          </p>
          <Link href="/login" className="btn btn--primary btn--sm">
            Log in to comment
          </Link>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="feedback feedback--error" style={{ marginBottom: 'var(--space-4)' }}>
          {error}
        </div>
      )}

      {/* ── Comment list ────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {[...Array(2)].map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 12, width: '30%', marginBottom: 8, borderRadius: 4 }} />
                <div className="skeleton" style={{ height: 14, width: '80%', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-10) 0', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }}>💬</div>
          <p style={{ fontSize: 'var(--text-sm)' }}>No comments yet. Start the conversation!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {comments.map((comment) => (
            <div key={comment.id}>
              {/* Top-level comment */}
              <CommentBubble
                comment={comment}
                currentUserId={currentUser?.id}
                onReply={() => {
                  const name = getDisplayName(comment.profiles) || 'User';
                  setReplyTo({ id: comment.id, authorName: name });
                  setReplyBody('');
                  setTimeout(() => document.getElementById(`reply-input-${comment.id}`)?.focus(), 50);
                }}
                onDelete={handleDelete}
                deletingId={deletingId}
                isReply={false}
              />

              {/* Replies */}
              {comment.replies?.length > 0 && (
                <div style={{
                  marginLeft:  'var(--space-10)',
                  paddingLeft: 'var(--space-4)',
                  borderLeft:  '2px solid var(--color-border-subtle)',
                  marginBottom:'var(--space-2)',
                }}>
                  {comment.replies.map(reply => (
                    <CommentBubble
                      key={reply.id}
                      comment={reply}
                      currentUserId={currentUser?.id}
                      onReply={() => {
                        const name = getDisplayName(comment.profiles);
                        setReplyTo({ id: comment.id, authorName: name });
                        setReplyBody('');
                        setTimeout(() => document.getElementById(`reply-input-${comment.id}`)?.focus(), 50);
                      }}
                      onDelete={handleDelete}
                      deletingId={deletingId}
                      isReply
                    />
                  ))}
                </div>
              )}

              {/* Inline reply compose box */}
              {replyTo?.id === comment.id && (
                <div style={{
                  marginLeft:    'var(--space-10)',
                  paddingLeft:   'var(--space-4)',
                  borderLeft:    '2px solid var(--color-accent-blue)',
                  marginBottom:  'var(--space-4)',
                  display:       'flex',
                  gap:           'var(--space-3)',
                  alignItems:    'flex-start',
                }}>
                  <UserAvatar userId={currentUser?.id} size="xs" />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize:     'var(--text-xs)',
                      color:        'var(--color-accent-blue)',
                      marginBottom: 'var(--space-2)',
                    }}>
                      Replying to {replyTo.authorName}
                    </div>
                    <textarea
                      id={`reply-input-${comment.id}`}
                      className="form-input"
                      placeholder={`Reply to ${replyTo.authorName}…`}
                      value={replyBody}
                      onChange={e => setReplyBody(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Escape') { setReplyTo(null); setReplyBody(''); }
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply();
                      }}
                      rows={2}
                      style={{ resize: 'none', fontSize: 'var(--text-sm)' }}
                    />
                    <div style={{
                      display:        'flex',
                      gap:            'var(--space-2)',
                      marginTop:      'var(--space-2)',
                      justifyContent: 'flex-end',
                    }}>
                      <button
                        onClick={() => { setReplyTo(null); setReplyBody(''); }}
                        className="btn btn--ghost btn--sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleReply}
                        disabled={submitting || !replyBody.trim()}
                        className="btn btn--primary btn--sm"
                      >
                        {submitting ? 'Posting…' : 'Reply'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Single comment bubble ──────────────────────────────────
function CommentBubble({ comment, currentUserId, onReply, onDelete, deletingId, isReply }) {
  const author      = comment.profiles;
  const displayName = getDisplayName(author);
  const initials    = getInitials(displayName);
  const isOwn       = currentUserId && author?.id === currentUserId;
  const isDeleting  = deletingId === comment.id;

  return (
    <div style={{
      display:       'flex',
      gap:           'var(--space-3)',
      padding:       'var(--space-4) 0',
      borderBottom:  '1px solid var(--color-border-subtle)',
      opacity:       isDeleting ? 0.5 : 1,
      transition:    'opacity var(--transition-fast)',
    }}>
      {/* Avatar */}
      <Link
        href={`/profile/${comment.profiles?.username}`} 
        style={{ textDecoration: 'none', flexShrink: 0 }}
        >
        {comment.profiles?.avatar_url ? ( 
            <img
            src={comment.profiles.avatar_url} 
            alt={displayName}
            className={`avatar ${isReply ? 'avatar--xs' : 'avatar--sm'}`}
            />
        ) : (
          <div
            className={`avatar ${isReply ? 'avatar--xs' : 'avatar--sm'}`}
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              background:     'var(--color-bg-overlay)',
              fontSize:       isReply ? '9px' : 'var(--text-xs)',
              fontWeight:     'var(--weight-semibold)',
              color:          'var(--color-text-secondary)',
            }}
          >
            {initials}
          </div>
        )}
      </Link>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Author + time */}
        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          'var(--space-2)',
          marginBottom: 'var(--space-2)',
          flexWrap:     'wrap',
        }}>
          <Link
            href={`/profile/${author?.username}`}
            style={{
              fontSize:       'var(--text-sm)',
              fontWeight:     'var(--weight-semibold)',
              color:          'var(--color-text-primary)',
              textDecoration: 'none',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-accent-blue)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-primary)'}
          >
            {displayName}
          </Link>
          {isOwn && (
            <span className="badge badge--blue" style={{ fontSize: '10px' }}>You</span>
          )}
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {timeAgo(comment.created_at)}
          </span>
        </div>

        {/* Body */}
        <p style={{
          fontSize:   'var(--text-sm)',
          color:      'var(--color-text-secondary)',
          lineHeight: 'var(--leading-normal)',
          wordBreak:  'break-word',
        }}>
          {comment.content}
        </p>

        {/* Actions */}
        <div style={{
          display:    'flex',
          gap:        'var(--space-3)',
          marginTop:  'var(--space-3)',
          alignItems: 'center',
        }}>
          {currentUserId && !isReply && (
            <button
              onClick={onReply}
              style={{
                background: 'transparent',
                border:     'none',
                padding:    0,
                fontSize:   'var(--text-xs)',
                color:      'var(--color-text-muted)',
                cursor:     'pointer',
                display:    'flex',
                alignItems: 'center',
                gap:        'var(--space-1)',
                transition: 'color var(--transition-fast)',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--color-accent-blue)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 14 4 9 9 4"/>
                <path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
              </svg>
              Reply
            </button>
          )}
          {isOwn && (
            <button
              onClick={() => onDelete(comment.id)}
              disabled={isDeleting}
              style={{
                background: 'transparent',
                border:     'none',
                padding:    0,
                fontSize:   'var(--text-xs)',
                color:      'var(--color-text-muted)',
                cursor:     isDeleting ? 'not-allowed' : 'pointer',
                display:    'flex',
                alignItems: 'center',
                gap:        'var(--space-1)',
                transition: 'color var(--transition-fast)',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--color-accent-red)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inline avatar fetcher ──────────────────────────────────
// Fetches the current user's profile for the compose box avatar.
function UserAvatar({ userId, size = 'sm' }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('avatar_url, username, full_name')
      .eq('id', userId)
      .single()
      .then(({ data }) => setProfile(data));
  }, [userId]);

  const initials = getInitials(getDisplayName(profile));

  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="" className={`avatar avatar--${size}`} />;
  }
  return (
    <div className={`avatar avatar--${size}`} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg-overlay)',
      fontSize: size === 'xs' ? '9px' : 'var(--text-xs)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--color-text-secondary)',
    }}>
      {initials}
    </div>
  );
}