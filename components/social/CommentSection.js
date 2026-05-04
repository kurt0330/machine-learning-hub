'use client';
// ── Comment Section ────────────────────────────────────────
// Schema: comments.user_id, comments.content, comments.is_deleted
// Soft delete: sets is_deleted = true via UPDATE policy.
// Threading: parent_id for one level of replies.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { getDisplayName, getInitials, timeAgo } from '../../lib/helpers';

// ── Deleted comment placeholder ────────────────────────────
const DELETED_PLACEHOLDER = 'This comment was deleted by the user.';

export default function CommentSection({ articleId, currentUser }) {
  const [comments,   setComments]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [body,       setBody]       = useState('');
  const [replyTo,    setReplyTo]    = useState(null); // { id, authorName }
  const [replyBody,  setReplyBody]  = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [softDeleting, setSoftDeleting] = useState(null); // id being soft-deleted
  const [error,      setError]      = useState('');

  // ── Fetch & build comment tree ─────────────────────────
  const fetchComments = useCallback(async () => {
    // Select: content (not body), user_id, is_deleted
    const { data, error: fetchError } = await supabase
      .from('comments')
      .select(`
        id, content, created_at, parent_id, is_deleted,
        user_id,
        profiles:user_id (
          id, username, full_name, avatar_url
        )
      `)
      .eq('article_id', articleId)
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('[CommentSection]', fetchError.message);
      setLoading(false);
      return;
    }

    // Build tree
    const all      = data ?? [];
    const topLevel = all.filter(c => !c.parent_id);
    const replies  = all.filter(c =>  c.parent_id);

    const tree = topLevel.map(c => ({
      ...c,
      replies: replies.filter(r => r.parent_id === c.id),
    }));

    setComments(tree);
    setLoading(false);
  }, [articleId]);

  // ── Realtime subscription ──────────────────────────────
  useEffect(() => {
    fetchComments();

    const channel = supabase
      .channel(`comments-rt-${articleId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',           // INSERT, UPDATE (soft delete), DELETE
          schema: 'public',
          table:  'comments',
          filter: `article_id=eq.${articleId}`,
        },
        fetchComments
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [articleId, fetchComments]);

  // ── Post top-level comment ─────────────────────────────
  async function handlePost() {
    if (!body.trim() || !currentUser) return;
    setError('');
    setSubmitting(true);

    const { error: postError } = await supabase
      .from('comments')
      .insert({
        article_id: articleId,
        user_id:    currentUser.id,  // comments table uses user_id
        content:    body.trim(),     // comments table uses content
        parent_id:  null,
        is_deleted: false,
      });

    if (postError) setError('Could not post comment. Please try again.');
    else setBody('');
    setSubmitting(false);
  }

  // ── Post reply ─────────────────────────────────────────
  async function handleReply() {
    if (!replyBody.trim() || !currentUser || !replyTo) return;
    setError('');
    setSubmitting(true);

    const { error: replyError } = await supabase
      .from('comments')
      .insert({
        article_id: articleId,
        user_id:    currentUser.id,  // comments.user_id
        content:    replyBody.trim(), // comments.content
        parent_id:  replyTo.id,
        is_deleted: false,
      });

    if (replyError) setError('Could not post reply. Please try again.');
    else { setReplyTo(null); setReplyBody(''); }
    setSubmitting(false);
  }

  // ── Soft delete ────────────────────────────────────────
  // Uses UPDATE policy: Auth Update Own Comments (auth.uid() = user_id)
  // Sets is_deleted = true. Content is kept in DB but hidden in UI.
  async function handleSoftDelete(commentId) {
    if (!currentUser) return;
    if (!window.confirm('Delete this comment? It will be marked as deleted and hidden.')) return;

    setSoftDeleting(commentId);

    const { error: delError } = await supabase
      .from('comments')
      .update({ is_deleted: true })         // soft delete
      .eq('id', commentId)
      .eq('user_id', currentUser.id);       // comments.user_id — matches RLS

    if (delError) setError('Could not delete comment.');
    setSoftDeleting(null);
  }

  const totalVisible = comments.reduce((sum, c) => {
    const topCounts = 1;
    const replyCounts = (c.replies ?? []).length;
    return sum + topCounts + replyCounts;
  }, 0);

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
        <span className="badge badge--neutral">{totalVisible}</span>
      </h2>

      {/* ── Compose box ─────────────────────────────── */}
      {currentUser ? (
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', alignItems: 'flex-start' }}>
          <AuthorAvatar userId={currentUser.id} size="sm" />
          <div style={{ flex: 1 }}>
            <textarea
              className="form-input form-textarea"
              placeholder="Share your thoughts…"
              value={body}
              onChange={e => setBody(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost(); }}
              rows={3}
              style={{ resize: 'vertical', minHeight: '80px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Ctrl+Enter to post</span>
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
        <div style={{ padding: 'var(--space-4)', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)', textAlign: 'center', marginBottom: 'var(--space-6)', border: '1px dashed var(--color-border-default)' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>Join the discussion</p>
          <Link href="/login" className="btn btn--primary btn--sm">Log in to comment</Link>
        </div>
      )}

      {error && <div className="feedback feedback--error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}

      {/* ── Comment list ────────────────────────────── */}
      {loading ? (
        <CommentSkeletons />
      ) : comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-10) 0', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }}>💬</div>
          <p style={{ fontSize: 'var(--text-sm)' }}>No comments yet. Start the conversation!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {comments.map(comment => (
            <div key={comment.id}>
              <CommentBubble
                comment={comment}
                currentUserId={currentUser?.id}
                softDeleting={softDeleting}
                onReply={() => {
                  setReplyTo({ id: comment.id, authorName: getDisplayName(comment.profiles) });
                  setReplyBody('');
                  setTimeout(() => document.getElementById(`reply-box-${comment.id}`)?.focus(), 50);
                }}
                onSoftDelete={handleSoftDelete}
                isReply={false}
              />

              {/* Replies */}
              {(comment.replies ?? []).length > 0 && (
                <div style={{ marginLeft: 'var(--space-10)', paddingLeft: 'var(--space-4)', borderLeft: '2px solid var(--color-border-subtle)', marginBottom: 'var(--space-2)' }}>
                  {comment.replies.map(reply => (
                    <CommentBubble
                      key={reply.id}
                      comment={reply}
                      currentUserId={currentUser?.id}
                      softDeleting={softDeleting}
                      onReply={() => {
                        setReplyTo({ id: comment.id, authorName: getDisplayName(comment.profiles) });
                        setReplyBody('');
                        setTimeout(() => document.getElementById(`reply-box-${comment.id}`)?.focus(), 50);
                      }}
                      onSoftDelete={handleSoftDelete}
                      isReply
                    />
                  ))}
                </div>
              )}

              {/* Inline reply box */}
              {replyTo?.id === comment.id && (
                <div style={{ marginLeft: 'var(--space-10)', paddingLeft: 'var(--space-4)', borderLeft: '2px solid var(--color-accent-blue)', marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                  <AuthorAvatar userId={currentUser?.id} size="xs" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent-blue)', marginBottom: 'var(--space-2)' }}>
                      Replying to {replyTo.authorName}
                    </div>
                    <textarea
                      id={`reply-box-${comment.id}`}
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
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)', justifyContent: 'flex-end' }}>
                      <button onClick={() => { setReplyTo(null); setReplyBody(''); }} className="btn btn--ghost btn--sm">Cancel</button>
                      <button onClick={handleReply} disabled={submitting || !replyBody.trim()} className="btn btn--primary btn--sm">
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
function CommentBubble({ comment, currentUserId, softDeleting, onReply, onSoftDelete, isReply }) {
  const author      = comment.profiles;
  const displayName = getDisplayName(author);
  const initials    = getInitials(displayName);
  const isOwn       = !!(currentUserId && comment.user_id === currentUserId); // comments.user_id
  const isDeleted   = comment.is_deleted;
  const isSoftDel   = softDeleting === comment.id;

  return (
    <div style={{
      display:      'flex',
      gap:          'var(--space-3)',
      padding:      'var(--space-4) 0',
      borderBottom: '1px solid var(--color-border-subtle)',
      opacity:      isSoftDel ? 0.5 : 1,
      transition:   'opacity var(--transition-fast)',
    }}>
      {/* Avatar — hidden for deleted comments */}
      {!isDeleted ? (
        <Link href={`/profile/${author?.username}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
          {author?.avatar_url ? (
            <img src={author.avatar_url} alt={displayName} className={`avatar ${isReply ? 'avatar--xs' : 'avatar--sm'}`} />
          ) : (
            <div className={`avatar ${isReply ? 'avatar--xs' : 'avatar--sm'}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-overlay)', fontSize: isReply ? '9px' : 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-secondary)' }}>
              {initials}
            </div>
          )}
        </Link>
      ) : (
        // Ghost avatar for deleted comment
        <div className={`avatar ${isReply ? 'avatar--xs' : 'avatar--sm'}`} style={{ background: 'var(--color-bg-elevated)', flexShrink: 0 }} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {isDeleted ? (
          // ── Soft-deleted state ─────────────────────
          <p style={{
            fontSize:   'var(--text-sm)',
            color:      'var(--color-text-muted)',
            fontStyle:  'italic',
            padding:    'var(--space-2) 0',
          }}>
            {DELETED_PLACEHOLDER}
          </p>
        ) : (
          // ── Normal state ───────────────────────────
          <>
            {/* Author + timestamp */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
              <Link
                href={`/profile/${author?.username}`}
                style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-primary)', textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--color-accent-blue)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-primary)'}
              >
                {displayName}
              </Link>
              {isOwn && <span className="badge badge--blue" style={{ fontSize: '10px' }}>You</span>}
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                {timeAgo(comment.created_at)}
              </span>
            </div>

            {/* Content — comments.content column */}
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 'var(--leading-normal)', wordBreak: 'break-word' }}>
              {comment.content}
            </p>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)', alignItems: 'center' }}>
              {currentUserId && !isReply && (
                <ActionBtn
                  onClick={onReply}
                  hoverColor="var(--color-accent-blue)"
                  icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>}
                >
                  Reply
                </ActionBtn>
              )}
              {isOwn && (
                <ActionBtn
                  onClick={() => onSoftDelete(comment.id)}
                  disabled={isSoftDel}
                  hoverColor="var(--color-accent-red)"
                  icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>}
                >
                  {isSoftDel ? 'Deleting…' : 'Delete'}
                </ActionBtn>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Tiny action button ─────────────────────────────────────
function ActionBtn({ onClick, disabled, hoverColor, icon, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'transparent', border: 'none', padding: 0,
        fontSize:   'var(--text-xs)',
        color:      hovered ? hoverColor : 'var(--color-text-muted)',
        cursor:     disabled ? 'not-allowed' : 'pointer',
        display:    'flex', alignItems: 'center', gap: 'var(--space-1)',
        transition: 'color var(--transition-fast)',
      }}
    >
      {icon}
      {children}
    </button>
  );
}

// ── Avatar fetcher for compose boxes ──────────────────────
function AuthorAvatar({ userId, size = 'sm' }) {
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    if (!userId) return;
    supabase.from('profiles').select('avatar_url, username, full_name').eq('id', userId).single()
      .then(({ data }) => setProfile(data));
  }, [userId]);
  const initials = getInitials(getDisplayName(profile));
  if (profile?.avatar_url) return <img src={profile.avatar_url} alt="" className={`avatar avatar--${size}`} />;
  return (
    <div className={`avatar avatar--${size}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-overlay)', fontSize: size === 'xs' ? '9px' : 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-secondary)' }}>
      {initials}
    </div>
  );
}

// ── Skeleton loaders ───────────────────────────────────────
function CommentSkeletons() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {[...Array(2)].map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 12, width: '25%', marginBottom: 8, borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 14, width: '75%', borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}