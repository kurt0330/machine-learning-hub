'use client';
// ── Dashboard / Feed Page ──────────────────────────────────

import { useUser, useAuthGuard } from '../../hooks/useUser';
import Feed from '../../components/feed/Feed';

export default function DashboardPage() {
  const { user, profile, loading } = useUser();
  useAuthGuard(user, loading);

  if (loading) {
    return (
      <main className="page" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="spinner" />
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-content">

        {/* ── Page header ─────────────────────────────── */}
        <div style={{
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          marginBottom:    'var(--space-8)',
          flexWrap:        'wrap',
          gap:             'var(--space-4)',
        }}>
          <div>
            <h1 style={{
              fontSize:     'var(--text-xl)',
              fontWeight:   'var(--weight-bold)',
              color:        'var(--color-text-primary)',
              marginBottom: 'var(--space-1)',
            }}>
              Discovery Feed
            </h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Explore the latest breakthroughs across science and technology.
            </p>
          </div>

          {/* Session indicator */}
          <div style={{
            display:     'flex',
            alignItems:  'center',
            gap:         'var(--space-2)',
            padding:     'var(--space-2) var(--space-4)',
            background:  'var(--color-bg-surface)',
            border:      '1px solid var(--color-border-subtle)',
            borderRadius:'var(--radius-full)',
          }}>
            <span className="status-dot status-dot--green" />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent-green)' }}>
              Signed in as {profile?.username ?? user?.email?.split('@')[0]}
            </span>
          </div>
        </div>

        {/* ── Feed ────────────────────────────────────── */}
        <Feed />

      </div>
    </main>
  );
}