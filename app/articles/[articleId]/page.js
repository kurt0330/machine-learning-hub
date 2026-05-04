'use client';
// ── Article Reader Page ────────────────────────────────────
// Renders article content as text/Markdown.
// Shows Delete button only when auth.user.id === author_id.
// Realtime notification toast is handled globally in layout.

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { useUser } from '../../../hooks/useUser';
import {
  getDisplayName,
  getInitials,
  formatDate,
  getStorageUrl,
} from '../../../lib/helpers';
import LikeButton    from '../../../components/social/LikeButton';
import CommentSection from '../../../components/social/CommentSection';

// ── Lightweight Markdown renderer ──────────────────────────
// Handles headings, bold, italic, code blocks, lists, links.
// No external dependency needed for this scope.
function renderMarkdown(text) {
  if (!text) return '';

  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    // Code blocks (``` ... ```)
    .replace(/```([\s\S]*?)```/g, '<pre style="background:var(--color-bg-elevated);border:1px solid var(--color-border-default);border-radius:var(--radius-md);padding:var(--space-4);overflow-x:auto;font-family:var(--font-mono);font-size:var(--text-sm);line-height:1.6;margin:var(--space-4) 0"><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:var(--color-bg-elevated);border:1px solid var(--color-border-subtle);border-radius:4px;padding:2px 6px;font-family:var(--font-mono);font-size:0.85em">$1</code>')
    // H1 – H3
    .replace(/^### (.+)$/gm, '<h3 style="font-size:var(--text-md);font-weight:var(--weight-bold);color:var(--color-text-primary);margin:var(--space-6) 0 var(--space-2)">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 style="font-size:var(--text-lg);font-weight:var(--weight-bold);color:var(--color-text-primary);margin:var(--space-6) 0 var(--space-3)">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 style="font-size:var(--text-xl);font-weight:var(--weight-black);color:var(--color-text-primary);margin:var(--space-6) 0 var(--space-3)">$1</h1>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,     '<strong style="color:var(--color-text-primary);font-weight:var(--weight-bold)">$1</strong>')
    .replace(/\*(.+?)\*/g,         '<em>$1</em>')
    // Blockquotes
    .replace(/^&gt; (.+)$/gm, '<blockquote style="border-left:3px solid var(--color-border-strong);padding-left:var(--space-4);color:var(--color-text-secondary);font-style:italic;margin:var(--space-4) 0">$1</blockquote>')
    // Unordered lists
    .replace(/^[*\-] (.+)$/gm, '<li style="margin-bottom:var(--space-1)">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="padding-left:var(--space-6);margin:var(--space-3) 0;color:var(--color-text-secondary)">$&</ul>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-bottom:var(--space-1)">$1</li>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--color-border-default);margin:var(--space-6) 0" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--color-accent-blue);text-decoration:underline">$1</a>')
    // Paragraphs (double newline)
    .replace(/\n\n+/g, '</p><p style="margin:var(--space-4) 0;line-height:var(--leading-loose);color:var(--color-text-secondary)">')
    // Single newlines → <br>
    .replace(/\n/g, '<br/>');
}

export default function ArticleReaderPage() {
  const { articleId }    = useParams();
  const router           = useRouter();
  const { user }         = useUser();

  const [article,    setArticle]    = useState(null);
  const [isLiked,    setIsLiked]    = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [deleting,   setDeleting]   = useState(false);
  const [shareMsg,   setShareMsg]   = useState('');

  // ── Fetch article ──────────────────────────────────────
  const fetchArticle = useCallback(async () => {
    const { data, error } = await supabase
      .from('articles')
      .select(`
        id, title, description, content, cover_url,
        likes_count, created_at, author_id,
        profiles:author_id (
          id, username, full_name, avatar_url
        )
      `)
      .eq('id', articleId)
      .single();

    if (error || !data) {
      router.replace('/dashboard');
      return;
    }

    setArticle(data);
    setLikesCount(data.likes_count ?? 0);

    // Check like status for current user
    if (user?.id) {
      const { data: likeRow } = await supabase
        .from('likes')
        .select('id')
        .eq('article_id', articleId)
        .eq('user_id', user.id)        // likes table uses user_id
        .maybeSingle();
      setIsLiked(!!likeRow);
    }

    setLoading(false);
  }, [articleId, user?.id, router]);

  useEffect(() => { fetchArticle(); }, [fetchArticle]);

  // ── Delete article ─────────────────────────────────────
  // RLS policy: Authors Delete Own Articles (auth.uid() = author_id)
  async function handleDelete() {
    if (!window.confirm('Are you sure you want to permanently delete this article? This cannot be undone.')) return;

    setDeleting(true);

    // Delete cover from storage if it exists
    if (article.cover_url) {
      await supabase.storage.from('articles').remove([article.cover_url]);
    }

    // Delete the article row — RLS enforces author_id match
    const { error } = await supabase
      .from('articles')
      .delete()
      .eq('id', article.id)
      .eq('author_id', user.id);    // articles table uses author_id

    if (error) {
      alert('Delete failed: ' + error.message);
      setDeleting(false);
      return;
    }

    router.replace('/dashboard');
  }

  // ── Share ──────────────────────────────────────────────
  async function handleShare() {
    const url   = window.location.href;
    const title = article?.title ?? '';
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setShareMsg('Link copied!');
        setTimeout(() => setShareMsg(''), 2500);
      } catch {
        setShareMsg('Could not copy.');
        setTimeout(() => setShareMsg(''), 2500);
      }
    }
  }

  // ── Like toggle ────────────────────────────────────────
  function handleLikeToggle(newLiked, newCount) {
    setIsLiked(newLiked);
    setLikesCount(newCount);
  }

  // ── Loading / not found ────────────────────────────────
  if (loading) {
    return (
      <main className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </main>
    );
  }
  if (!article) return null;

  const author       = article.profiles;
  const displayName  = getDisplayName(author);
  const initials     = getInitials(displayName);
  const coverUrl     = article.cover_url ? getStorageUrl('articles', article.cover_url) : null;
  const isAuthor     = user?.id && user.id === article.author_id; // articles.author_id

  return (
    <main className="page">
      <div style={{ maxWidth: 'var(--max-width-md)', margin: '0 auto', padding: 'var(--space-8) var(--space-6)' }}>

        {/* ── Breadcrumb ──────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          <Link href="/dashboard" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}
            onMouseEnter={e => e.target.style.color = 'var(--color-text-primary)'}
            onMouseLeave={e => e.target.style.color = 'var(--color-text-muted)'}
          >
            Feed
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
            {article.title}
          </span>
        </div>

        {/* ── Cover image ─────────────────────────────── */}
        {coverUrl && (
          <div style={{ width: '100%', maxHeight: '380px', borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: 'var(--space-8)', background: 'var(--color-bg-surface)' }}>
            <img src={coverUrl} alt={article.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        )}

        {/* ── Article header ──────────────────────────── */}
        <h1 style={{
          fontSize:     'var(--text-3xl)',
          fontWeight:   'var(--weight-black)',
          color:        'var(--color-text-primary)',
          lineHeight:   'var(--leading-tight)',
          letterSpacing:'var(--tracking-tight)',
          marginBottom: 'var(--space-4)',
        }}>
          {article.title}
        </h1>

        {article.description && (
          <p style={{
            fontSize:     'var(--text-md)',
            color:        'var(--color-text-secondary)',
            lineHeight:   'var(--leading-normal)',
            marginBottom: 'var(--space-6)',
            fontStyle:    'italic',
          }}>
            {article.description}
          </p>
        )}

        {/* ── Author row + actions ─────────────────────── */}
        <div style={{
          display:       'flex',
          alignItems:    'center',
          gap:           'var(--space-4)',
          marginBottom:  'var(--space-8)',
          paddingBottom: 'var(--space-6)',
          borderBottom:  '1px solid var(--color-border-subtle)',
          flexWrap:      'wrap',
        }}>
          {/* Author */}
          <Link href={`/profile/${author?.username}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', textDecoration: 'none', flex: 1 }}>
            {author?.avatar_url ? (
              <img src={author.avatar_url} alt={displayName} className="avatar avatar--md" />
            ) : (
              <div className="avatar avatar--md" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-overlay)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-secondary)' }}>
                {initials}
              </div>
            )}
            <div>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
                {displayName}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                {formatDate(article.created_at)}
              </p>
            </div>
          </Link>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <LikeButton
              articleId={article.id}
              initialLiked={isLiked}
              initialCount={likesCount}
              currentUserId={user?.id ?? null}
              onToggle={handleLikeToggle}
            />

            {/* Share */}
            <div style={{ position: 'relative' }}>
              <button onClick={handleShare} className="btn btn--secondary btn--sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Share
              </button>
              {shareMsg && (
                <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, background: 'var(--color-bg-overlay)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-md)', zIndex: 10 }}>
                  {shareMsg}
                </div>
              )}
            </div>

            {/* Delete — only visible to the author */}
            {isAuthor && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn btn--danger btn--sm"
              >
                {deleting ? (
                  <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Deleting…</>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                    Delete
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* ── Article content ──────────────────────────── */}
        <article
          style={{ marginBottom: 'var(--space-12)' }}
          dangerouslySetInnerHTML={{
            __html: `<p style="margin:var(--space-4) 0;line-height:var(--leading-loose);color:var(--color-text-secondary)">${renderMarkdown(article.content)}</p>`,
          }}
        />

        {/* ── Divider ─────────────────────────────────── */}
        <div className="divider" style={{ marginBottom: 'var(--space-8)' }} />

        {/* ── Comment section ──────────────────────────── */}
        <CommentSection articleId={article.id} currentUser={user} />

      </div>
    </main>
  );
}