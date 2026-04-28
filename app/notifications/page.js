'use client';
// ── Notifications Page ─────────────────────────────────────
// Shows all in-app notifications for the current user.
// Filters by recipient_id, joins profiles on actor_id.

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useUser, useAuthGuard } from '../../hooks/useUser';
import { getDisplayName, getInitials, timeAgo } from '../../lib/helpers';

// ── Notification type config ───────────────────────────────
const NOTIF_CONFIG = {
  like: {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24"
        fill="currentColor" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
    color:      'var(--color-accent-red)',
    background: 'var(--color-accent-red-dim)',
    label:      (actor) => `${actor} liked your article`,
  },
  comment: {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    color:      'var(--color-accent-blue)',
    background: 'var(--color-accent-blue-dim)',
    label:      (actor) => `${actor} commented on your article`,
  },
  reply: {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 14 4 9 9 4"/>
        <path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
      </svg>
    ),
    color:      'var(--color-accent-green)',
    background: 'var(--color-accent-green-dim)',
    label:      (actor) => `${actor} replied to your comment`,
  },
  new_article: {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
    color:      'var(--color-accent-amber)',
    background: 'var(--color-accent-amber-dim)',
    label:      (actor) => `${actor} published a new article`,
  },
};

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  useAuthGuard(user, userLoading);

  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [markingAll,    setMarkingAll]     = useState(false);
  const [filter,        setFilter]         = useState('all'); // 'all' | 'unread'

  // ── Fetch notifications ────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id, type, is_read, created_at,
        article_id, comment_id,
        actor:actor_id (
          id, username, full_name, avatar_url
        ),
        article:article_id (
          id, title
        )
      `)
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) {
      console.error('[Notifications] fetch error:', error.message);
      setLoading(false);
      return;
    }

    setNotifications(data ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!userLoading) fetchNotifications();
  }, [userLoading, fetchNotifications]);

  // ── Realtime: new notifications appear instantly ───────
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications-page-${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        fetchNotifications
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user?.id, fetchNotifications]);

  // ── Mark one notification as read ─────────────────────
  async function markAsRead(notifId) {
    setNotifications(prev =>
      prev.map(n => n.id === notifId ? { ...n, is_read: true } : n)
    );
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId)
      .eq('recipient_id', user.id); // schema: recipient_id
  }

  // ── Mark all as read ───────────────────────────────────
  async function markAllAsRead() {
    const unread = notifications.filter(n => !n.is_read);
    if (!unread.length) return;

    setMarkingAll(true);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', user.id)  // schema: recipient_id
      .eq('is_read', false);

    setMarkingAll(false);
  }

  // ── Handle notification click ──────────────────────────
  async function handleClick(notif) {
    if (!notif.is_read) await markAsRead(notif.id);

    // Navigate to relevant content
    if (notif.article_id) {
      router.push(`/articles/${notif.article_id}`);
    }
  }

  // ── Filtered list ──────────────────────────────────────
  const displayed = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // ── Loading guard ──────────────────────────────────────
  if (userLoading || loading) {
    return (
      <main className="page" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-content--narrow" style={{ paddingTop: 'var(--space-10)' }}>

        {/* ── Page header ─────────────────────────────── */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          marginBottom:   'var(--space-6)',
          flexWrap:       'wrap',
          gap:            'var(--space-4)',
        }}>
          <div>
            <h1 style={{
              fontSize:     'var(--text-xl)',
              fontWeight:   'var(--weight-bold)',
              color:        'var(--color-text-primary)',
              marginBottom: 'var(--space-1)',
              display:      'flex',
              alignItems:   'center',
              gap:          'var(--space-3)',
            }}>
              Notifications
              {unreadCount > 0 && (
                <span
                  className="badge badge--red"
                  style={{ fontSize: 'var(--text-xs)' }}
                >
                  {unreadCount} new
                </span>
              )}
            </h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Likes, comments, and replies on your articles
            </p>
          </div>

          {/* Mark all read */}
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              disabled={markingAll}
              className="btn btn--secondary btn--sm"
            >
              {markingAll
                ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Marking…</>
                : '✓ Mark all as read'
              }
            </button>
          )}
        </div>

        {/* ── Filter tabs ──────────────────────────────── */}
        <div className="tabs" style={{ marginBottom: 'var(--space-4)' }}>
          <button
            className={`tab ${filter === 'all' ? 'tab--active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
            <span style={{
              marginLeft: 'var(--space-2)',
              fontSize:   'var(--text-xs)',
              color:      filter === 'all'
                ? 'var(--color-text-primary)'
                : 'var(--color-text-muted)',
            }}>
              {notifications.length}
            </span>
          </button>
          <button
            className={`tab ${filter === 'unread' ? 'tab--active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread
            {unreadCount > 0 && (
              <span style={{
                marginLeft:   'var(--space-2)',
                fontSize:     'var(--text-xs)',
                color:        filter === 'unread'
                  ? 'var(--color-accent-red)'
                  : 'var(--color-text-muted)',
              }}>
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Notification list ────────────────────────── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

          {displayed.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            <div>
              {displayed.map((notif, index) => (
                <NotificationRow
                  key={notif.id}
                  notif={notif}
                  isLast={index === displayed.length - 1}
                  onClick={() => handleClick(notif)}
                  onMarkRead={() => markAsRead(notif.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {notifications.length >= 60 && (
          <p style={{
            textAlign:  'center',
            fontSize:   'var(--text-xs)',
            color:      'var(--color-text-muted)',
            marginTop:  'var(--space-4)',
          }}>
            Showing the 60 most recent notifications.
          </p>
        )}

      </div>
    </main>
  );
}

// ── Single notification row ────────────────────────────────
function NotificationRow({ notif, isLast, onClick, onMarkRead }) {
  const config      = NOTIF_CONFIG[notif.type] ?? NOTIF_CONFIG.comment;
  const actor       = notif.actor;
  const displayName = getDisplayName(actor);
  const initials    = getInitials(displayName);
  const isUnread    = !notif.is_read;

  return (
    <div
      onClick={onClick}
      style={{
        display:     'flex',
        alignItems:  'flex-start',
        gap:         'var(--space-4)',
        padding:     'var(--space-4) var(--space-5)',
        borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
        background:   isUnread
          ? 'rgba(255,255,255,0.02)'
          : 'transparent',
        cursor:       'pointer',
        transition:   'background var(--transition-fast)',
        position:     'relative',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-elevated)'}
      onMouseLeave={e =>
        e.currentTarget.style.background = isUnread
          ? 'rgba(255,255,255,0.02)'
          : 'transparent'
      }
    >
      {/* Unread indicator stripe */}
      {isUnread && (
        <div style={{
          position:     'absolute',
          left:         0,
          top:          0,
          bottom:       0,
          width:        '3px',
          background:   'var(--color-accent-blue)',
          borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
        }} />
      )}

      {/* Actor avatar + type icon */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {actor?.avatar_url ? (
          <img
            src={actor.avatar_url}
            alt={displayName}
            className="avatar avatar--md"
          />
        ) : (
          <div
            className="avatar avatar--md"
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

        {/* Type icon badge */}
        <div style={{
          position:        'absolute',
          bottom:          '-2px',
          right:           '-4px',
          width:           '20px',
          height:          '20px',
          borderRadius:    'var(--radius-full)',
          background:      config.background,
          border:          `2px solid var(--color-bg-base)`,
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          color:           config.color,
        }}>
          {config.icon}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Main label */}
        <p style={{
          fontSize:     'var(--text-sm)',
          color:        'var(--color-text-primary)',
          lineHeight:   'var(--leading-snug)',
          marginBottom: 'var(--space-1)',
          fontWeight:   isUnread
            ? 'var(--weight-medium)'
            : 'var(--weight-normal)',
        }}>
          <span style={{ fontWeight: 'var(--weight-semibold)' }}>
            {displayName}
          </span>
          {' '}
          {config.label('').replace(displayName, '').trim()}
        </p>

        {/* Article title reference */}
        {notif.article?.title && (
          <p style={{
            fontSize:     'var(--text-xs)',
            color:        'var(--color-text-muted)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
            marginBottom: 'var(--space-1)',
          }}>
            on &ldquo;{notif.article.title}&rdquo;
          </p>
        )}

        {/* Timestamp */}
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          {timeAgo(notif.created_at)}
        </p>
      </div>

      {/* Right side: mark read button + unread dot */}
      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:        'var(--space-2)',
        flexShrink: 0,
      }}>
        {isUnread && (
          <button
            onClick={e => { e.stopPropagation(); onMarkRead(); }}
            style={{
              background:   'transparent',
              border:       'none',
              padding:      'var(--space-1)',
              cursor:       'pointer',
              color:        'var(--color-text-muted)',
              borderRadius: 'var(--radius-sm)',
              transition:   'color var(--transition-fast), background var(--transition-fast)',
              display:      'flex',
              alignItems:   'center',
            }}
            title="Mark as read"
            onMouseEnter={e => {
              e.currentTarget.style.color      = 'var(--color-accent-blue)';
              e.currentTarget.style.background = 'var(--color-accent-blue-dim)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color      = 'var(--color-text-muted)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        )}

        {/* Unread dot */}
        {isUnread && (
          <div style={{
            width:        '8px',
            height:       '8px',
            borderRadius: 'var(--radius-full)',
            background:   'var(--color-accent-blue)',
            flexShrink:   0,
          }} />
        )}

        {/* Arrow */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--color-border-strong)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────
function EmptyState({ filter }) {
  return (
    <div style={{
      textAlign:  'center',
      padding:    'var(--space-20) var(--space-6)',
      color:      'var(--color-text-muted)',
    }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-4)' }}>
        {filter === 'unread' ? '✅' : '🔔'}
      </div>
      <p style={{
        fontSize:     'var(--text-base)',
        color:        'var(--color-text-secondary)',
        marginBottom: 'var(--space-2)',
        fontWeight:   'var(--weight-medium)',
      }}>
        {filter === 'unread'
          ? 'All caught up!'
          : 'No notifications yet'
        }
      </p>
      <p style={{ fontSize: 'var(--text-sm)' }}>
        {filter === 'unread'
          ? 'You have no unread notifications.'
          : 'When someone likes or comments on your articles, you\'ll see it here.'
        }
      </p>
      {filter === 'unread' && (
        <p style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-3)' }}>
          Switch to "All" to see your notification history.
        </p>
      )}
    </div>
  );
}