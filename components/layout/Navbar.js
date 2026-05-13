'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import { getDisplayName, getInitials } from '../../lib/helpers';
import NewAlertButton from './NewAlertButton'; 

export default function Navbar() {
  const pathname = usePathname();
  
  // 1. EXTRACT 'loading' FROM useUser HOOK
  // This allows the Navbar to know if Supabase is still checking for a session.
  const { user, profile, loading, signOut } = useUser();
  
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

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
    const channel = supabase.channel('navbar-notifs').on('postgres_changes', {
      event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}`
    }, () => fetchUnread()).subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const displayName = getDisplayName(profile);
  const initials = getInitials(displayName);

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 'var(--nav-height)',
      background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 var(--space-6)', zIndex: 1000, backdropFilter: 'blur(8px)',
    }}>
      <Link href="/dashboard" style={{
        fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-primary)',
        textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
      }}>
        <div style={{ width: '32px', height: '32px', background: 'var(--color-primary)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '18px' }}>ML</div>
        <span className="hide-mobile">HUB</span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        
        {/* 2. THE GHOST FIX: CONDITIONAL RENDERING BASED ON LOADING STATE */}
        {loading ? (
          // While session is being checked, show a placeholder to prevent flicker
          <div style={{ width: '80px' }} /> 
        ) : user ? (
          <>
            {/* AUTHENTICATED VIEW */}
            <Link href="/articles/upload" className="btn btn--primary btn--sm hide-mobile">
              Upload
            </Link>

            <NewAlertButton />

            <Link href="/notifications" style={{ position: 'relative', display: 'flex', color: 'var(--color-text-secondary)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {unreadCount > 0 && <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', background: 'var(--color-accent-red)', borderRadius: '50%', border: '2px solid var(--color-bg-surface)' }} />}
            </Link>

            <div style={{ position: 'relative' }} ref={menuRef}>
              <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}>
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="avatar avatar--sm" /> : <div className="avatar avatar--sm" style={{ background: 'var(--color-bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-secondary)' }}>{initials}</div>}
              </button>

              {menuOpen && (
                <div className="dropdown-menu">
                  <DropdownItem href={`/profile/${profile?.username}`} onClick={() => setMenuOpen(false)}>My Profile</DropdownItem>
                  <DropdownItem href="/profile/edit" onClick={() => setMenuOpen(false)}>Settings</DropdownItem>
                  <div style={{ height: '1px', background: 'var(--color-border-subtle)', margin: 'var(--space-1) 0' }} />
                  <button onClick={signOut} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-accent-red)', background: 'none', border: 'none', cursor: 'pointer' }}>Log Out</button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* GUEST VIEW */}
            <Link href="/login" className="btn btn--ghost btn--sm">Log In</Link>
            <Link href="/signup" className="btn btn--primary btn--sm">Sign Up</Link>
          </>
        )}
      </div>

      <style jsx>{`
        .dropdown-menu {
          position: absolute; top: calc(100% + 8px); right: 0; width: 200px;
          background: var(--color-bg-surface); border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-md); box-shadow: var(--shadow-lg); padding: var(--space-2) 0;
          z-index: 1001;
        }
        @media (max-width: 480px) {
          .hide-mobile { display: none; }
        }
      `}</style>
    </nav>
  );
}

function DropdownItem({ href, onClick, children }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{ display: 'block', padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', textDecoration: 'none' }}
    >
      {children}
    </Link>
  );
}