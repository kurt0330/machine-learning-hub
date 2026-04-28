'use client';
// ── Sign Up Page ───────────────────────────────────────────

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function SignUpPage() {
  const router = useRouter();

  const [email,     setEmail]     = useState('');
  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [message,   setMessage]   = useState({ type: '', text: '' });

  async function handleSignUp() {
    // ── Client-side validation ──────────────────────────
    if (!email || !username || !password || !confirm) {
      setMessage({ type: 'error', text: 'Please fill in all fields.' });
      return;
    }
    if (username.length < 3) {
      setMessage({ type: 'error', text: 'Username must be at least 3 characters.' });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setMessage({ type: 'error', text: 'Username can only contain letters, numbers, and underscores.' });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (password !== confirm) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    // ── Check username uniqueness ───────────────────────
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.toLowerCase())
      .maybeSingle();

    if (existing) {
      setMessage({ type: 'error', text: 'That username is already taken.' });
      setLoading(false);
      return;
    }

    // ── Create auth user ────────────────────────────────
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setMessage({ type: 'error', text: signUpError.message });
      setLoading(false);
      return;
    }

    // ── Update the auto-created profile with their chosen username ──
    if (signUpData.user) {
      await supabase
        .from('profiles')
        .update({ username: username.toLowerCase() })
        .eq('id', signUpData.user.id);
    }

    setMessage({
      type: 'success',
      text: '✅ Account created! Check your email to confirm, then log in.',
    });
    setLoading(false);
  }

  // ── Password strength indicator ────────────────────────
  function getPasswordStrength(pwd) {
    if (!pwd) return null;
    if (pwd.length < 6) return { label: 'Too short', color: 'var(--color-accent-red)' };
    if (pwd.length < 8)  return { label: 'Weak',      color: 'var(--color-accent-amber)' };
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && pwd.length >= 10)
                         return { label: 'Strong',    color: 'var(--color-accent-green)' };
    return               { label: 'Fair',       color: 'var(--color-accent-blue)' };
  }

  const strength = getPasswordStrength(password);

  return (
    <main
      style={{
        minHeight:      '100vh',
        background:     'var(--color-bg-base)',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        'var(--space-6)',
      }}
    >
      {/* Back link */}
      <Link
        href="/"
        style={{
          color:          'var(--color-text-muted)',
          fontSize:       'var(--text-sm)',
          textDecoration: 'none',
          marginBottom:   'var(--space-6)',
          alignSelf:      'flex-start',
          maxWidth:       'var(--max-width-sm)',
          width:          '100%',
          margin:         '0 auto var(--space-6)',
          display:        'block',
          transition:     'color var(--transition-fast)',
        }}
        onMouseEnter={e => e.target.style.color = 'var(--color-text-secondary)'}
        onMouseLeave={e => e.target.style.color = 'var(--color-text-muted)'}
      >
        ← Back to Home
      </Link>

      {/* Card */}
      <div
        className="card"
        style={{
          width:    '100%',
          maxWidth: 'var(--max-width-sm)',
          padding:  'var(--space-8)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <span
              style={{
                fontWeight:    'var(--weight-bold)',
                fontSize:      'var(--text-base)',
                letterSpacing: 'var(--tracking-tight)',
                color:         'var(--color-text-primary)',
              }}
            >
              ML — HUB
            </span>
          </div>
          <h1
            style={{
              fontSize:     'var(--text-xl)',
              fontWeight:   'var(--weight-bold)',
              color:        'var(--color-text-primary)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Create your account
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Join ML-Hub and start sharing your research
          </p>
        </div>

        {/* Email */}
        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input
            type="email"
            className="form-input"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        {/* Username */}
        <div className="form-group">
          <label className="form-label">Username</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. john_doe"
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase())}
            autoComplete="username"
          />
          <span className="form-hint">Letters, numbers, and underscores only.</span>
        </div>

        {/* Password */}
        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            type="password"
            className="form-input"
            placeholder="Minimum 6 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          {/* Strength indicator */}
          {strength && (
            <span
              className="form-hint"
              style={{ color: strength.color, transition: 'color var(--transition-fast)' }}
            >
              Strength: {strength.label}
            </span>
          )}
        </div>

        {/* Confirm password */}
        <div className="form-group">
          <label className="form-label">Confirm Password</label>
          <input
            type="password"
            className={`form-input ${
              confirm && confirm !== password ? 'form-input--error' : ''
            }`}
            placeholder="Re-enter your password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSignUp()}
            autoComplete="new-password"
          />
          {confirm && confirm !== password && (
            <span className="form-hint" style={{ color: 'var(--color-accent-red)' }}>
              Passwords do not match.
            </span>
          )}
        </div>

        {/* Feedback */}
        {message.text && (
          <div
            className={`feedback ${
              message.type === 'error' ? 'feedback--error' : 'feedback--success'
            }`}
            style={{ marginBottom: 'var(--space-5)' }}
          >
            {message.text}
          </div>
        )}

        {/* Submit */}
        <button
          className="btn btn--primary btn--full btn--lg"
          onClick={handleSignUp}
          disabled={loading}
          style={{ marginBottom: 'var(--space-4)' }}
        >
          {loading
            ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Creating account…</>
            : 'Create Account'
          }
        </button>

        {/* Divider */}
        <div className="divider--text" style={{ margin: 'var(--space-6) 0' }}>
          already have an account?
        </div>

        {/* Login link */}
        <Link
          href="/login"
          className="btn btn--secondary btn--full"
        >
          Log In Instead
        </Link>
      </div>
    </main>
  );
}