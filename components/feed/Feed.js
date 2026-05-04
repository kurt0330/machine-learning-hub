'use client';

import { useState, useEffect, useCallback } from 'react';

// 1. Reverted to your original working supabase path
import { supabase } from '../../lib/supabase'; 

import FeedTabs from './FeedTabs';
import ArticleCard from './ArticleCard';

// 2. Reverted to your original working hooks path
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

  const fetchArticles = useCallback(async (tab, pageIndex = 0) => {
    const from = pageIndex * ARTICLES_PER_PAGE;
    const to   = from + ARTICLES_PER_PAGE - 1;

    // THE ACTUAL FIX: Only asking for columns that exist!
    let query = supabase
      .from('articles')
      .select('id, title, description, cover_url, likes_count, created_at, author_id');

    if (tab === 'new') {
      query = query.order('created_at', { ascending: false }).range(from, to);
    } else if (tab === 'top5') {
      query = query.order('likes_count', { ascending: false }).limit(5);
    } else {
      query = query.order('created_at', { ascending: false }).range(from, to);
    }

    const { data, error } = await query;
    if (error) { 
      console.error('[Feed] fetch error:', error.message); 
      return []; 
    }
    return data ?? [];
  }, []);

  const fetchLikedIds = useCallback(async () => {
    if (!user?.id) { setLikedIds(new Set()); return; }
    const { data } = await supabase
      .from('likes')
      .select('article_id')
      .eq('user_id', user.id);

    setLikedIds(new Set((data ?? []).map(r => r.article_id)));
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    setPage(0);
    Promise.all([
      fetchArticles(activeTab, 0),
      fetchLikedIds(),
    ]).then(([data]) => {
      setArticles(data);
      setHasMore(activeTab !== 'top5' && data.length === ARTICLES_PER_PAGE);
      setLoading(false);
    });
  }, [activeTab, fetchArticles, fetchLikedIds]);

  async function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    const data = await fetchArticles(activeTab, nextPage);
    setArticles(prev => [...prev, ...data]);
    setHasMore(data.length === ARTICLES_PER_PAGE);
    setPage(nextPage);
    setLoadingMore(false);
  }

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

  return (
    <div>
      <FeedTabs activeTab={activeTab} onChange={setActiveTab} />

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '100px', borderRadius: 'var(--radius-md)' }} />
          ))}
        </div>
      )}

      {!loading && articles.length === 0 && (
        <div style={{ textAlign: 'center', padding: 'var(--space-20)', color: 'var(--color-text-muted)' }}>
          <p>No articles yet. Be the first to upload!</p>
        </div>
      )}

      {!loading && articles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
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

      {!loading && hasMore && (
        <div style={{ textAlign: 'center', marginTop: 'var(--space-8)' }}>
          <button onClick={loadMore} disabled={loadingMore} className="btn btn--secondary">
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}