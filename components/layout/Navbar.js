'use client';
// ── Navbar ─────────────────────────────────────────────────
// Fixed top bar with brand, upload CTA, notification bell,
// and profile avatar. Reads from useUser() for live state.

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import { getDisplayName, getInitials } from '../../lib/helpers';

export default function Navbar() {
  const pathname               = usePathname();
  const { user, profile, signOut } = useUser();

  const [unreadCount,  setUnreadCount]  = useState(0);
  const [menuOpen,     setMenuOpen]     = useState(false);
  const menuRef = useRef(null);

  // ── Fetch unread notification count ─────────────────────
  useEffect(() => {
    if (!user?.id) { setUnreadCount(0); return; }

    async function fetchUnread() {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      setUnreadCount(count ?? 0);
    }

    fetchUnread();

    // Realtime subscription — red dot updates instantly
    const channel = supabase
      .channel(`notif-count-${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        fetchUnread
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user?.id]);

  // ── Close dropdown on outside click ─────────────────────
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const displayName = getDisplayName(profile);
  const initials    = getInitials(displayName);
  const avatarUrl   = profile?.avatar_url || null;

  // Don't render navbar on auth pages
  if (pathname === '/login' || pathname === '/signup') return null;

  return (
    <nav className="navbar">

      {/* ── Brand ──────────────────────────────────────── */}
      <Link href={user ? '/dashboard' : '/'} className="navbar__brand">
        ML — HUB
      </Link>

      {/* ── Right side actions ─────────────────────────── */}
      <div className="navbar__actions">

        {user ? (
          <>
            {/* Upload button */}
            <Link
              href="/articles/upload"
              className="btn btn--secondary btn--sm"
              style={{ gap: 'var(--space-2)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Upload
            </Link>

            {/* Notification bell */}
            <Link
              href="/profile"
              style={{ position: 'relative', display: 'inline-flex' }}
              aria-label="Notifications"
            >
              <button
                className="btn btn--ghost btn--icon"
                style={{ position: 'relative' }}
                tabIndex={-1}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadCount > 0 && (
                  <span className="notif-dot" aria-label={`${unreadCount} unread`} />
                )}
              </button>
            </Link>

            {/* Profile dropdown ──────────────────────── */}
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(prev => !prev)}
                style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          'var(--space-2)',
                  background:   'transparent',
                  border:       '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-full)',
                  padding:      '3px var(--space-3) 3px 3px',
                  cursor:       'pointer',
                  transition:   'border-color var(--transition-fast)',
                }}
                onMouseEnter={e =>
                  e.currentTarget.style.borderColor = 'var(--color-border-hover)'}
                onMouseLeave={e =>
                  e.currentTarget.style.borderColor = 'var(--color-border-default)'}
                aria-label="Profile menu"
              >
                {/* Avatar */}
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="avatar avatar--xs"
                  />
                ) : (
                  <div
                    className="avatar avatar--xs"
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
                {/* Name — hidden on mobile */}
                <span
                  style={{
                    fontSize:   'var(--text-sm)',
                    fontWeight: 'var(--weight-medium)',
                    color:      'var(--color-text-primary)',
                    maxWidth:   '120px',
                    overflow:   'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  className="hide-mobile"
                >
                  {displayName}
                </span>
                {/* Chevron */}
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="var(--color-text-muted)" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{
                    transform:  menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform var(--transition-fast)',
                  }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {/* Dropdown menu */}
              {menuOpen && (
                <div
                  style={{
                    position:     'absolute',
                    top:          'calc(100% + var(--space-2))',
                    right:        0,
                    minWidth:     '180px',
                    background:   'var(--color-bg-overlay)',
                    border:       '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow:    'var(--shadow-lg)',
                    overflow:     'hidden',
                    zIndex:       200,
                    animation:    'dropdown-in 0.15s ease',
                  }}
                >
                  <DropdownItem href="/profile" onClick={() => setMenuOpen(false)}>
                    My Profile
                  </DropdownItem>
                  <DropdownItem href="/dashboard" onClick={() => setMenuOpen(false)}>
                    Feed
                  </DropdownItem>
                  <div style={{
                    height:     '1px',
                    background: 'var(--color-border-subtle)',
                    margin:     'var(--space-1) 0',
                  }} />
                  <button
                    onClick={() => { setMenuOpen(false); signOut(); }}
                    style={{
                      display:    'block',
                      width:      '100%',
                      padding:    'var(--space-3) var(--space-4)',
                      background: 'transparent',
                      border:     'none',
                      textAlign:  'left',
                      fontSize:   'var(--text-sm)',
                      color:      'var(--color-accent-red)',
                      cursor:     'pointer',
                      transition: 'background var(--transition-fast)',
                    }}
                    onMouseEnter={e =>
                      e.currentTarget.style.background = 'var(--color-accent-red-dim)'}
                    onMouseLeave={e =>
                      e.currentTarget.style.background = 'transparent'}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Not logged in */
          <>
            <Link href="/login"  className="btn btn--ghost btn--sm">Log In</Link>
            <Link href="/signup" className="btn btn--primary btn--sm">Sign Up</Link>
          </>
        )}
      </div>

      {/* Dropdown animation */}
      <style>{`
        @keyframes dropdown-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 480px) {
          .hide-mobile { display: none; }
        }
      `}</style>
    </nav>
  );
}

// ── Small helper: dropdown link item ──────────────────────
function DropdownItem({ href, onClick, children }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display:        'block',
        padding:        'var(--space-3) var(--space-4)',
        fontSize:       'var(--text-sm)',
        color:          'var(--color-text-secondary)',
        textDecoration: 'none',
        transition:     'background var(--transition-fast), color var(--transition-fast)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--color-bg-elevated)';
        e.currentTarget.style.color      = 'var(--color-text-primary)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color      = 'var(--color-text-secondary)';
      }}
    >
      {children}
    </Link>
  );
}