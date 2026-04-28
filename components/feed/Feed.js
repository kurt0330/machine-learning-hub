'use client';
// ── Feed ───────────────────────────────────────────────────
// Fetches and renders articles based on the active tab.
// Subscribes to realtime inserts so new posts appear live.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import FeedTabs from './FeedTabs';
import ArticleCard from './ArticleCard';
import { useUser } from '../../hooks/useUser';

const ARTICLES_PER_PAGE = 10;

export default function Feed() {
  const { user } = useUser();

  const [activeTab,  setActiveTab]  = useState('all');
  const [articles,   setArticles]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingMore,setLoadingMore]= useState(false);
  const [hasMore,    setHasMore]    = useState(false);
  const [page,       setPage]       = useState(0);
  const [likedIds,   setLikedIds]   = useState(new Set());

  // ── Fetch articles for the active tab ─────────────────
  const fetchArticles = useCallback(async (tab, pageIndex = 0) => {
    const from = pageIndex * ARTICLES_PER_PAGE;
    const to   = from + ARTICLES_PER_PAGE - 1;

    let query = supabase
      .from('articles')
      .select(`
        id, title, description, cover_url, file_url,
        likes_count, created_at,
        profiles:author_id (
          id, username, full_name, avatar_url
        )
      `);

    if (tab === 'new') {
      query = query
        .order('created_at', { ascending: false })
        .range(from, to);
    } else if (tab === 'top5') {
      query = query
        .order('likes_count', { ascending: false })
        .limit(5);
    } else {
      // 'all' — most recent first
      query = query
        .order('created_at', { ascending: false })
        .range(from, to);
    }

    const { data, error } = await query;
    if (error) { console.error('[Feed] fetch error:', error.message); return []; }
    return data ?? [];
  }, []);

  // ── Fetch which articles the current user has liked ───
  const fetchLikedIds = useCallback(async () => {
    if (!user?.id) { setLikedIds(new Set()); return; }
    const { data } = await supabase
      .from('likes')
      .select('article_id')
      .eq('user_id', user.id);

    setLikedIds(new Set((data ?? []).map(r => r.article_id)));
  }, [user?.id]);

  // ── Initial load + tab switch ─────────────────────────
  useEffect(() => {
    setLoading(true);
    setPage(0);
    setHasMore(false);

    Promise.all([
      fetchArticles(activeTab, 0),
      fetchLikedIds(),
    ]).then(([data]) => {
      setArticles(data);
      setHasMore(activeTab !== 'top5' && data.length === ARTICLES_PER_PAGE);
      setLoading(false);
    });
  }, [activeTab, fetchArticles, fetchLikedIds]);

  // ── Load more (pagination) ────────────────────────────
  async function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    const data = await fetchArticles(activeTab, nextPage);
    setArticles(prev => [...prev, ...data]);
    setHasMore(data.length === ARTICLES_PER_PAGE);
    setPage(nextPage);
    setLoadingMore(false);
  }

  // ── Realtime: new article appears in feed instantly ───
  useEffect(() => {
    if (activeTab !== 'all' && activeTab !== 'new') return;

    const channel = supabase
      .channel('feed-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'articles' },
        async (payload) => {
          // Fetch full record with profile join
          const { data } = await supabase
            .from('articles')
            .select(`
              id, title, description, cover_url, file_url,
              likes_count, created_at,
              profiles:author_id (id, username, full_name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setArticles(prev => [data, ...prev]);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [activeTab]);

  // ── Optimistic like toggle (updates card instantly) ───
  function handleLikeToggle(articleId, newLiked, newCount) {
    setLikedIds(prev => {
      const next = new Set(prev);
      newLiked ? next.add(articleId) : next.delete(articleId);
      return next;
    });
    setArticles(prev =>
      prev.map(a => a.id === articleId ? { ...a, likes_count: newCount } : a)
    );
  }

  // ── Render ─────────────────────────────────────────────
  return (
    <div>
      <FeedTabs activeTab={activeTab} onChange={setActiveTab} />

      {/* Loading skeletons */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {[...Array(3)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && articles.length === 0 && (
        <div style={{
          textAlign:  'center',
          padding:    'var(--space-20) var(--space-6)',
          color:      'var(--color-text-muted)',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-4)' }}>📭</div>
          <p style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
            {activeTab === 'top5'
              ? 'No liked articles yet. Be the first to like!'
              : 'No articles yet. Be the first to upload!'}
          </p>
        </div>
      )}

      {/* Article list */}
      {!loading && articles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {activeTab === 'top5' && (
            <div style={{
              fontSize:     'var(--text-xs)',
              color:        'var(--color-text-muted)',
              letterSpacing:'var(--tracking-widest)',
              textTransform:'uppercase',
              marginBottom: 'var(--space-2)',
            }}>
              🏆 Top {articles.length} most liked articles
            </div>
          )}
          {articles.map((article, index) => (
            <ArticleCard
              key={article.id}
              article={article}
              rank={activeTab === 'top5' ? index + 1 : null}
              isLiked={likedIds.has(article.id)}
              currentUserId={user?.id ?? null}
              onLikeToggle={handleLikeToggle}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {!loading && hasMore && (
        <div style={{ textAlign: 'center', marginTop: 'var(--space-8)' }}>
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="btn btn--secondary"
          >
            {loadingMore
              ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Loading…</>
              : 'Load more'
            }
          </button>
        </div>
      )}
    </div>
  );
}

// ── Skeleton loader card ────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="card--flat" style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
      <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 'var(--radius-full)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 'var(--space-2)', borderRadius: 'var(--radius-sm)' }} />
        <div className="skeleton" style={{ height: 20, width: '85%', marginBottom: 'var(--space-3)', borderRadius: 'var(--radius-sm)' }} />
        <div className="skeleton" style={{ height: 13, width: '40%', borderRadius: 'var(--radius-sm)' }} />
      </div>
    </div>
  );
}