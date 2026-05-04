'use client';
// ── Notification Toast ─────────────────────────────────────
// Realtime listener on notifications table.
// Fires a toast when a new row arrives with recipient_id = user.id.
// Clicking navigates to the article via router.push().
// Mount this once inside app/layout.js.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../hooks/useUser';

// How long each toast stays on screen (ms)
const TOAST_DURATION = 6000;

export default function NotificationToast() {
  const router      = useRouter();
  const { user }    = useUser();
  const [toasts, setToasts] = useState([]); // [{ id, title, articleId, notifId }]
  const timeouts    = useRef({});

  // ── Dismiss a single toast ─────────────────────────────
  const dismiss = useCallback((toastId) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
    clearTimeout(timeouts.current[toastId]);
    delete timeouts.current[toastId];
  }, []);

  // ── Show a new toast ───────────────────────────────────
  const showToast = useCallback((toast) => {
    setToasts(prev => {
      // Avoid duplicates
      if (prev.some(t => t.notifId === toast.notifId)) return prev;
      return [toast, ...prev].slice(0, 4); // max 4 stacked
    });
    // Auto-dismiss
    timeouts.current[toast.id] = setTimeout(() => dismiss(toast.id), TOAST_DURATION);
  }, [dismiss]);

  // ── Realtime subscription ──────────────────────────────
  // Watches notifications table filtered by recipient_id.
  // Columns: recipient_id, article_id, title, type, is_read
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notif-toast-${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const notif = payload.new;
          // notifications.title holds the article title (set by trigger)
          if (!notif?.article_id) return;

          showToast({
            id:        `toast-${notif.id}-${Date.now()}`,
            notifId:   notif.id,
            articleId: notif.article_id,
            title:     notif.title ?? 'New article posted',
            type:      notif.type  ?? 'new_article',
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      // Clear all timers on unmount
      Object.values(timeouts.current).forEach(clearTimeout);
    };
  }, [user?.id, showToast]);

  // ── Handle toast click ─────────────────────────────────
  async function handleToastClick(toast) {
    // Mark as read
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', toast.notifId)
      .eq('recipient_id', user.id);  // notifications.recipient_id

    dismiss(toast.id);
    router.push(`/articles/${toast.articleId}`);
  }

  if (toasts.length === 0) return null;

  return (
    <>
      {/* Toast stack — fixed bottom-right */}
      <div style={{
        position:       'fixed',
        bottom:         'var(--space-6)',
        right:          'var(--space-6)',
        display:        'flex',
        flexDirection:  'column-reverse',
        gap:            'var(--space-3)',
        zIndex:         999,
        maxWidth:       '340px',
        width:          'calc(100vw - var(--space-12))',
      }}>
        {toasts.map((toast, index) => (
          <ToastCard
            key={toast.id}
            toast={toast}
            index={index}
            onClick={() => handleToastClick(toast)}
            onDismiss={() => dismiss(toast.id)}
          />
        ))}
      </div>

      <style>{`
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateX(20px) scale(0.96); }
          to   { opacity: 1; transform: translateX(0)    scale(1);    }
        }
      `}</style>
    </>
  );
}

// ── Individual toast card ──────────────────────────────────
function ToastCard({ toast, index, onClick, onDismiss }) {
  const typeConfig = {
    new_article: { label: 'New article',  color: 'var(--color-accent-amber)',  bg: 'var(--color-accent-amber-dim)'  },
    like:        { label: 'New like',     color: 'var(--color-accent-red)',    bg: 'var(--color-accent-red-dim)'    },
    comment:     { label: 'New comment',  color: 'var(--color-accent-blue)',   bg: 'var(--color-accent-blue-dim)'   },
    reply:       { label: 'New reply',    color: 'var(--color-accent-green)',  bg: 'var(--color-accent-green-dim)'  },
  };
  const cfg = typeConfig[toast.type] ?? typeConfig.new_article;

  return (
    <div
      style={{
        background:   'var(--color-bg-overlay)',
        border:       '1px solid var(--color-border-default)',
        borderLeft:   `4px solid ${cfg.color}`,
        borderRadius: 'var(--radius-lg)',
        padding:      'var(--space-4)',
        boxShadow:    'var(--shadow-xl)',
        cursor:       'pointer',
        animation:    'toast-slide-in 0.25s ease forwards',
        display:      'flex',
        gap:          'var(--space-3)',
        alignItems:   'flex-start',
      }}
      onClick={onClick}
    >
      {/* Type badge */}
      <div style={{
        flexShrink:     0,
        padding:        'var(--space-1) var(--space-2)',
        background:     cfg.bg,
        borderRadius:   'var(--radius-sm)',
        fontSize:       'var(--text-xs)',
        fontWeight:     'var(--weight-semibold)',
        color:          cfg.color,
        whiteSpace:     'nowrap',
        marginTop:      '1px',
      }}>
        {cfg.label}
      </div>

      {/* Message */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize:     'var(--text-sm)',
          fontWeight:   'var(--weight-medium)',
          color:        'var(--color-text-primary)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          marginBottom: 'var(--space-1)',
        }}>
          {toast.title}
        </p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          Tap to read →
        </p>
      </div>

      {/* Dismiss */}
      <button
        onClick={e => { e.stopPropagation(); onDismiss(); }}
        style={{
          flexShrink:  0,
          background:  'transparent',
          border:      'none',
          cursor:      'pointer',
          color:       'var(--color-text-muted)',
          padding:     'var(--space-1)',
          borderRadius:'var(--radius-sm)',
          lineHeight:  1,
          fontSize:    '16px',
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}