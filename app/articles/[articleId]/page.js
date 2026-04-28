'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { useUser } from '../../../hooks/useUser';
import { getDisplayName, getInitials, formatDate, isPDF, getStorageUrl } from '../../../lib/helpers';

// These paths match your "social" folder in the screenshot
import LikeButton from '../../../components/social/LikeButton';
import CommentSection from '../../../components/social/CommentSection';

export default function ArticleReaderPage() {
  const { articleId } = useParams();
  const router = useRouter();
  const { user } = useUser();

  const [article, setArticle] = useState(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('embed');

  useEffect(() => {
    if (!articleId) return;

    async function fetchData() {
      try {
        const { data, error } = await supabase
          .from('articles')
          .select(`
            id, title, description, file_url, cover_url,
            likes_count, created_at,
            profiles:author_id ( id, username, full_name, avatar_url )
          `)
          .eq('id', articleId)
          .single();

        if (error || !data) {
          router.replace('/dashboard');
          return;
        }

        setArticle(data);
        setLikesCount(data.likes_count ?? 0);

        if (user?.id) {
          const { data: likeRow } = await supabase
            .from('likes')
            .select('id')
            .eq('article_id', articleId)
            .eq('user_id', user.id)
            .maybeSingle();
          setIsLiked(!!likeRow);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [articleId, user?.id, router]);

  const handleLikeToggle = (newLiked, newCount) => {
    setIsLiked(newLiked);
    setLikesCount(newCount);
  };

  const handleDownload = async () => {
    if (!article?.file_url) return;
    const { data } = await supabase.storage.from('articles').download(article.file_url);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = article.file_url.split('/').pop();
      a.click();
    }
  };

  if (loading) return <div className="page" style={{display:'flex', justifyContent:'center', alignItems:'center'}}>Loading...</div>;
  if (!article) return null;

  const author = article.profiles;
  const displayName = getDisplayName(author);
  const fileUrl = getStorageUrl('articles', article.file_url);

  return (
    <main className="page">
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>{article.title}</h1>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
           <p>By <strong>{displayName}</strong></p>
           <span>•</span>
           <p>{formatDate(article.created_at)}</p>
        </div>

        <div className="card" style={{ padding: '1rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <LikeButton 
              articleId={article.id} 
              initialLiked={isLiked} 
              initialCount={likesCount} 
              currentUserId={user?.id} 
              onToggle={handleLikeToggle} 
            />
            <button onClick={() => setViewMode(v => v === 'embed' ? 'fullscreen' : 'embed')} className="btn btn--secondary btn--sm">
               {viewMode === 'embed' ? 'Full Screen' : 'Exit Full Screen'}
            </button>
          </div>

          {isPDF(article.file_url) ? (
            <iframe 
              src={`${fileUrl}#toolbar=0`} 
              style={{ width: '100%', height: viewMode === 'fullscreen' ? '90vh' : '600px', border: 'none', borderRadius: '8px' }} 
            />
          ) : (
            <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--color-bg-elevated)', borderRadius: '8px' }}>
               <p style={{ marginBottom: '1rem' }}>No preview available for this file type.</p>
               <button onClick={handleDownload} className="btn btn--primary">Download to Read</button>
            </div>
          )}
        </div>

        <CommentSection articleId={article.id} currentUser={user} />
      </div>
    </main>
  );
}