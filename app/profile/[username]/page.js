'use client';
// ── Public Profile Page ────────────────────────────────────
// Displays any user's profile by username.
// Shows their info, stats, and a grid of uploaded articles.

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { useUser } from '../../../hooks/useUser';
import { getDisplayName, getInitials, formatDate, timeAgo, formatCount, truncate, getStorageUrl } from '../../../lib/helpers';

export default function ProfilePage() {
  const { username }           = useParams();
  const router                 = useRouter();
  const { user: currentUser }  = useUser();

  const [profile,   setProfile]   = useState(null);
  const [articles,  setArticles]  = useState([]);
  const [stats,     setStats]     = useState({ articles: 0, totalLikes: 0 });
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('articles');

  const isOwnProfile = currentUser && profile && currentUser.id === profile.id;

  // ── Fetch profile + articles ───────────────────────────
  useEffect(() => {
    if (!username) return;

    async function fetchProfile() {
      // Fetch profile by username
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (error || !profileData) {
        router.replace('/dashboard');
        return;
      }

      setProfile(profileData);

      // Fetch their articles
      const { data: articlesData } = await supabase
        .from('articles')
        .select('id, title, description, cover_url, file_url, likes_count, created_at')
        .eq('author_id', profileData.id)
        .order('created_at', { ascending: false });

      const articleList = articlesData ?? [];
      setArticles(articleList);

      // Compute stats
      const totalLikes = articleList.reduce((sum, a) => sum + (a.likes_count ?? 0), 0);
      setStats({ articles: articleList.length, totalLikes });

      setLoading(false);
    }

    fetchProfile();
  }, [username, router]);

  // ── Loading ────────────────────────────────────────────
  if (loading) {
    return (
      <main className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </main>
    );
  }

  if (!profile) return null;

  const displayName = getDisplayName(profile);
  const initials    = getInitials(displayName);

  return (
    <main className="page">
      <div style={{ maxWidth: 'var(--max-width-lg)', margin: '0 auto', padding: 'var(--space-8) var(--space-6)' }}>

        {/* ════════════════════════════════════════════
            PROFILE HEADER
        ════════════════════════════════════════════ */}
        <div className="card" style={{ marginBottom: 'var(--space-8)', padding: 'var(--space-8)' }}>
          <div style={{
            display:    'flex',
            gap:        'var(--space-6)',
            alignItems: 'flex-start',
            flexWrap:   'wrap',
          }}>

            {/* Avatar */}
            <div style={{ flexShrink: 0 }}>
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="avatar avatar--xl"
                  style={{ width: '96px', height: '96px' }}
                />
              ) : (
                <div
                  className="avatar avatar--xl"
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    background:     'var(--color-bg-overlay)',
                    fontSize:       'var(--text-2xl)',
                    fontWeight:     'var(--weight-bold)',
                    color:          'var(--color-text-secondary)',
                    width:          '96px',
                    height:         '96px',
                  }}
                >
                  {initials}
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{
                display:      'flex',
                alignItems:   'center',
                gap:          'var(--space-3)',
                marginBottom: 'var(--space-2)',
                flexWrap:     'wrap',
              }}>
                <h1 style={{
                  fontSize:   'var(--text-xl)',
                  fontWeight: 'var(--weight-bold)',
                  color:      'var(--color-text-primary)',
                }}>
                  {displayName}
                </h1>
                {isOwnProfile && (
                  <span className="badge badge--green">You</span>
                )}
              </div>

              <p style={{
                fontSize:     'var(--text-sm)',
                color:        'var(--color-text-muted)',
                marginBottom: profile.bio ? 'var(--space-4)' : 0,
              }}>
                @{profile.username}
              </p>

              {profile.bio && (
                <p style={{
                  fontSize:     'var(--text-sm)',
                  color:        'var(--color-text-secondary)',
                  lineHeight:   'var(--leading-normal)',
                  marginBottom: 'var(--space-4)',
                  maxWidth:     '480px',
                }}>
                  {profile.bio}
                </p>
              )}

              {/* Member since */}
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                Member since {formatDate(profile.created_at)}
              </p>
            </div>

            {/* Edit button (own profile) */}
            {isOwnProfile && (
              <Link href="/profile/edit" className="btn btn--secondary btn--sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit Profile
              </Link>
            )}
          </div>

          {/* Stats bar */}
          <div className="divider" style={{ margin: 'var(--space-6) 0 var(--space-5)' }} />
          <div style={{
            display: 'flex',
            gap:     'var(--space-8)',
            flexWrap:'wrap',
          }}>
            <StatPill label="Articles" value={formatCount(stats.articles)} />
            <StatPill label="Total Likes" value={formatCount(stats.totalLikes)} accent />
          </div>
        </div>

        {/* ════════════════════════════════════════════
            TABS
        ════════════════════════════════════════════ */}
        <div className="tabs" style={{ marginBottom: 'var(--space-6)' }}>
          <button
            className={`tab ${activeTab === 'articles' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('articles')}
          >
            Articles
            <span style={{
              marginLeft: 'var(--space-2)',
              fontSize:   'var(--text-xs)',
              color:      activeTab === 'articles'
                ? 'var(--color-text-primary)'
                : 'var(--color-text-muted)',
            }}>
              {stats.articles}
            </span>
          </button>
        </div>

        {/* ════════════════════════════════════════════
            ARTICLE GRID
        ════════════════════════════════════════════ */}
        {articles.length === 0 ? (
          <div style={{
            textAlign:  'center',
            padding:    'var(--space-20) var(--space-6)',
            color:      'var(--color-text-muted)',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>📂</div>
            <p style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)' }}>
              {isOwnProfile ? "You haven't uploaded any articles yet." : `${displayName} hasn't posted anything yet.`}
            </p>
            {isOwnProfile && (
              <Link href="/articles/upload" className="btn btn--primary btn--sm">
                Upload your first article
              </Link>
            )}
          </div>
        ) : (
          <div style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap:                 'var(--space-4)',
          }}>
            {articles.map((article) => (
              <ProfileArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}

      </div>
    </main>
  );
}

// ── Profile article grid card ──────────────────────────────
function ProfileArticleCard({ article }) {
  const coverUrl = article.cover_url
    ? getStorageUrl('articles', article.cover_url)
    : null;

  return (
    <Link href={`/articles/${article.id}`} style={{ textDecoration: 'none' }}>
      <div
        className="card card--interactive"
        style={{ padding: 0, overflow: 'hidden', height: '100%' }}
      >
        {/* Cover */}
        <div style={{
          height:     coverUrl ? '140px' : '80px',
          background: coverUrl
            ? 'var(--color-bg-overlay)'
            : 'linear-gradient(135deg, var(--color-bg-surface) 0%, var(--color-bg-overlay) 100%)',
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow:   'hidden',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}>
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={article.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="var(--color-border-strong)" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: 'var(--space-4)' }}>
          {/* File type badge */}
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <span className="badge badge--neutral" style={{ fontSize: '10px' }}>
              {article.file_url?.split('.').pop()?.toUpperCase() ?? 'FILE'}
            </span>
          </div>

          {/* Title */}
          <h3 style={{
            fontSize:     'var(--text-sm)',
            fontWeight:   'var(--weight-semibold)',
            color:        'var(--color-text-primary)',
            lineHeight:   'var(--leading-snug)',
            marginBottom: 'var(--space-2)',
          }}>
            {truncate(article.title, 60)}
          </h3>

          {/* Description */}
          {article.description && (
            <p style={{
              fontSize:     'var(--text-xs)',
              color:        'var(--color-text-muted)',
              lineHeight:   'var(--leading-normal)',
              marginBottom: 'var(--space-3)',
            }}>
              {truncate(article.description, 80)}
            </p>
          )}

          {/* Footer */}
          <div style={{
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'center',
            paddingTop:     'var(--space-3)',
            borderTop:      '1px solid var(--color-border-subtle)',
          }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {timeAgo(article.created_at)}
            </span>
            <span style={{
              display:    'flex',
              alignItems: 'center',
              gap:        'var(--space-1)',
              fontSize:   'var(--text-xs)',
              color:      article.likes_count > 0
                ? 'var(--color-accent-red)'
                : 'var(--color-text-muted)',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24"
                fill={article.likes_count > 0 ? 'currentColor' : 'none'}
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              {formatCount(article.likes_count ?? 0)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Stat pill ──────────────────────────────────────────────
function StatPill({ label, value, accent }) {
  return (
    <div>
      <div style={{
        fontSize:   'var(--text-xl)',
        fontWeight: 'var(--weight-bold)',
        color:      accent ? 'var(--color-accent-red)' : 'var(--color-text-primary)',
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize:   'var(--text-xs)',
        color:      'var(--color-text-muted)',
        marginTop:  'var(--space-1)',
      }}>
        {label}
      </div>
    </div>
  );
}