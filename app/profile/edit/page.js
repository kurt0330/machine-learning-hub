'use client';
// ── Profile Edit Page ──────────────────────────────────────
// Updates the `profiles` table where id = current user.
// Handles avatar upload to the 'avatars' bucket.

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { useUser, useAuthGuard } from '../../../hooks/useUser';
import { getDisplayName, getInitials } from '../../../lib/helpers';

const MAX_AVATAR_SIZE = 3 * 1024 * 1024; // 3 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function ProfileEditPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading, refreshProfile } = useUser();
  useAuthGuard(user, userLoading);

  // ── Form fields ────────────────────────────────────────
  const [username,     setUsername]     = useState('');
  const [fullName,     setFullName]     = useState('');
  const [bio,          setBio]          = useState('');
  const [website,      setWebsite]      = useState('');

  // ── Avatar state ───────────────────────────────────────
  const [avatarFile,    setAvatarFile]    = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [currentAvatar, setCurrentAvatar] = useState(null);

  // ── UI state ───────────────────────────────────────────
  const [saving,         setSaving]         = useState(false);
  const [uploadingAvatar,setUploadingAvatar] = useState(false);
  const [successMsg,     setSuccessMsg]      = useState('');
  const [errorMsg,       setErrorMsg]        = useState('');
  const [fieldErrors,    setFieldErrors]     = useState({});

  const avatarInputRef = useRef(null);

  // ── Populate form from profile ─────────────────────────
  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username     ?? '');
    setFullName(profile.full_name    ?? '');
    setBio(profile.bio               ?? '');
    setWebsite(profile.website       ?? '');
    setCurrentAvatar(profile.avatar_url ?? null);
  }, [profile]);

  // ── Avatar file selection ──────────────────────────────
  function handleAvatarSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrorMsg('Avatar must be a JPG, PNG, WebP, or GIF.');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setErrorMsg('Avatar image must be under 3 MB.');
      return;
    }

    setErrorMsg('');
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function removeAvatarChange() {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  }

  // ── Field validation ───────────────────────────────────
  function validate() {
    const errors = {};

    if (!username.trim()) {
      errors.username = 'Username is required.';
    } else if (username.length < 3) {
      errors.username = 'Username must be at least 3 characters.';
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.username = 'Only letters, numbers, and underscores allowed.';
    }

    if (website.trim() && !/^https?:\/\/.+/.test(website.trim())) {
      errors.website = 'Website must start with http:// or https://';
    }

    if (bio.length > 300) {
      errors.bio = 'Bio must be 300 characters or fewer.';
    }

    return errors;
  }

  // ── Save handler ───────────────────────────────────────
  async function handleSave() {
    setErrorMsg('');
    setSuccessMsg('');

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);

    try {
      let avatarUrl = currentAvatar;

      // 1. Upload new avatar if one was selected
      if (avatarFile) {
        setUploadingAvatar(true);
        const ext      = avatarFile.name.split('.').pop();
        // profiles table uses `id` for the user identifier
        const filePath = `${user.id}/avatar-${Date.now()}.${ext}`;

        // Remove old avatar from storage if it exists
        if (currentAvatar) {
          const oldPath = currentAvatar.split('/avatars/')[1];
          if (oldPath) {
            await supabase.storage.from('avatars').remove([oldPath]);
          }
        }

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) throw new Error(uploadError.message);

        // Build public URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        avatarUrl = publicUrl;
        setUploadingAvatar(false);
      }

      // 2. Check username uniqueness (only if changed)
      if (username.toLowerCase() !== profile?.username?.toLowerCase()) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username.toLowerCase())
          .maybeSingle();

        if (existing) {
          setFieldErrors(prev => ({ ...prev, username: 'That username is already taken.' }));
          setSaving(false);
          return;
        }
      }

      // 3. Update profiles table — uses `id` as the identifier
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username:   username.trim().toLowerCase(),
          full_name:  fullName.trim()  || null,
          bio:        bio.trim()       || null,
          website:    website.trim()   || null,
          avatar_url: avatarUrl        || null,
        })
        .eq('id', user.id); // profiles table uses `id`

      if (updateError) throw new Error(updateError.message);

      // 4. Refresh global profile state
      refreshProfile();
      setCurrentAvatar(avatarUrl);
      setAvatarFile(null);
      setAvatarPreview(null);
      setSuccessMsg('Profile updated successfully!');

      // Redirect after short delay
      setTimeout(() => router.push(`/profile/${username.toLowerCase()}`), 1400);

    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
      setUploadingAvatar(false);
    } finally {
      setSaving(false);
    }
  }

  // ── Loading guard ──────────────────────────────────────
  if (userLoading || !profile) {
    return (
      <main className="page" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </main>
    );
  }

  const displayName  = getDisplayName(profile);
  const initials     = getInitials(displayName);
  const previewSrc   = avatarPreview ?? currentAvatar;
  const hasUnsaved   = avatarFile
    || username   !== (profile.username   ?? '')
    || fullName   !== (profile.full_name  ?? '')
    || bio        !== (profile.bio        ?? '')
    || website    !== (profile.website    ?? '');

  return (
    <main className="page">
      <div className="page-content--narrow" style={{ paddingTop: 'var(--space-10)' }}>

        {/* ── Breadcrumb ──────────────────────────────── */}
        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          'var(--space-2)',
          marginBottom: 'var(--space-6)',
          fontSize:     'var(--text-sm)',
          color:        'var(--color-text-muted)',
        }}>
          <Link
            href={`/profile/${profile.username}`}
            style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}
            onMouseEnter={e => e.target.style.color = 'var(--color-text-primary)'}
            onMouseLeave={e => e.target.style.color = 'var(--color-text-muted)'}
          >
            Profile
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>Edit</span>
        </div>

        {/* ── Page header ─────────────────────────────── */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h1 style={{
            fontSize:     'var(--text-xl)',
            fontWeight:   'var(--weight-bold)',
            color:        'var(--color-text-primary)',
            marginBottom: 'var(--space-1)',
          }}>
            Edit Profile
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Update how you appear to the community.
          </p>
        </div>

        {/* ════════════════════════════════════════════
            AVATAR SECTION
        ════════════════════════════════════════════ */}
        <div className="card" style={{ marginBottom: 'var(--space-5)', padding: 'var(--space-6)' }}>
          <h2 style={{
            fontSize:     'var(--text-base)',
            fontWeight:   'var(--weight-semibold)',
            color:        'var(--color-text-primary)',
            marginBottom: 'var(--space-5)',
          }}>
            Profile Photo
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
            {/* Avatar preview */}
            <div style={{ position: 'relative' }}>
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt="Avatar preview"
                  className="avatar"
                  style={{ width: '80px', height: '80px', objectFit: 'cover' }}
                />
              ) : (
                <div
                  className="avatar"
                  style={{
                    width:          '80px',
                    height:         '80px',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    background:     'var(--color-bg-overlay)',
                    fontSize:       'var(--text-xl)',
                    fontWeight:     'var(--weight-bold)',
                    color:          'var(--color-text-secondary)',
                  }}
                >
                  {initials}
                </div>
              )}

              {/* Upload overlay button */}
              <button
                onClick={() => avatarInputRef.current?.click()}
                style={{
                  position:       'absolute',
                  inset:          0,
                  borderRadius:   'var(--radius-full)',
                  background:     'rgba(0,0,0,0.5)',
                  border:         'none',
                  cursor:         'pointer',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  opacity:        0,
                  transition:     'opacity var(--transition-fast)',
                  color:          '#fff',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0}
                title="Change photo"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </button>
            </div>

            {/* Upload actions */}
            <div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="btn btn--secondary btn--sm"
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? 'Uploading…' : 'Choose photo'}
                </button>
                {avatarFile && (
                  <button
                    onClick={removeAvatarChange}
                    className="btn btn--ghost btn--sm"
                    style={{ color: 'var(--color-accent-red)' }}
                  >
                    Discard
                  </button>
                )}
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                JPG, PNG, WebP or GIF · Max 3 MB
              </p>
              {avatarFile && (
                <p style={{
                  fontSize:   'var(--text-xs)',
                  color:      'var(--color-accent-green)',
                  marginTop:  'var(--space-1)',
                }}>
                  ✓ New photo selected — save to apply
                </p>
              )}
            </div>
          </div>

          <input
            ref={avatarInputRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            onChange={handleAvatarSelect}
            style={{ display: 'none' }}
          />
        </div>

        {/* ════════════════════════════════════════════
            PROFILE FIELDS
        ════════════════════════════════════════════ */}
        <div className="card" style={{ marginBottom: 'var(--space-5)', padding: 'var(--space-6)' }}>
          <h2 style={{
            fontSize:     'var(--text-base)',
            fontWeight:   'var(--weight-semibold)',
            color:        'var(--color-text-primary)',
            marginBottom: 'var(--space-5)',
          }}>
            Basic Info
          </h2>

          {/* Username */}
          <div className="form-group">
            <label className="form-label">Username *</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position:   'absolute',
                left:       'var(--space-4)',
                top:        '50%',
                transform:  'translateY(-50%)',
                color:      'var(--color-text-muted)',
                fontSize:   'var(--text-sm)',
                pointerEvents: 'none',
              }}>
                @
              </span>
              <input
                type="text"
                className={`form-input ${fieldErrors.username ? 'form-input--error' : ''}`}
                placeholder="your_username"
                value={username}
                onChange={e => {
                  setUsername(e.target.value.toLowerCase());
                  setFieldErrors(prev => ({ ...prev, username: '' }));
                }}
                style={{ paddingLeft: 'var(--space-8)' }}
                maxLength={30}
                autoComplete="username"
              />
            </div>
            {fieldErrors.username
              ? <span className="form-hint" style={{ color: 'var(--color-accent-red)' }}>{fieldErrors.username}</span>
              : <span className="form-hint">Your unique handle. 3–30 characters, letters/numbers/underscores only.</span>
            }
          </div>

          {/* Full name */}
          <div className="form-group">
            <label className="form-label">
              Display Name{' '}
              <span style={{ color: 'var(--color-text-muted)', textTransform: 'none', letterSpacing: 0 }}>
                (optional)
              </span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Jane Doe"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              maxLength={60}
              autoComplete="name"
            />
            <span className="form-hint">
              Shown instead of your username across the platform.
            </span>
          </div>

          {/* Bio */}
          <div className="form-group">
            <label className="form-label">
              Bio{' '}
              <span style={{ color: 'var(--color-text-muted)', textTransform: 'none', letterSpacing: 0 }}>
                (optional)
              </span>
            </label>
            <textarea
              className={`form-input form-textarea ${fieldErrors.bio ? 'form-input--error' : ''}`}
              placeholder="Tell the community a little about yourself…"
              value={bio}
              onChange={e => {
                setBio(e.target.value);
                setFieldErrors(prev => ({ ...prev, bio: '' }));
              }}
              rows={3}
              maxLength={300}
              style={{ resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {fieldErrors.bio
                ? <span className="form-hint" style={{ color: 'var(--color-accent-red)' }}>{fieldErrors.bio}</span>
                : <span className="form-hint">Max 300 characters.</span>
              }
              <span className="form-hint" style={{
                color: bio.length > 280
                  ? 'var(--color-accent-amber)'
                  : 'var(--color-text-muted)',
              }}>
                {bio.length}/300
              </span>
            </div>
          </div>

          {/* Website */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Website{' '}
              <span style={{ color: 'var(--color-text-muted)', textTransform: 'none', letterSpacing: 0 }}>
                (optional)
              </span>
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position:      'absolute',
                left:          'var(--space-4)',
                top:           '50%',
                transform:     'translateY(-50%)',
                pointerEvents: 'none',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="var(--color-text-muted)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </span>
              <input
                type="url"
                className={`form-input ${fieldErrors.website ? 'form-input--error' : ''}`}
                placeholder="https://yoursite.com"
                value={website}
                onChange={e => {
                  setWebsite(e.target.value);
                  setFieldErrors(prev => ({ ...prev, website: '' }));
                }}
                style={{ paddingLeft: 'var(--space-10)' }}
                autoComplete="url"
              />
            </div>
            {fieldErrors.website && (
              <span className="form-hint" style={{ color: 'var(--color-accent-red)' }}>
                {fieldErrors.website}
              </span>
            )}
          </div>
        </div>

        {/* ── Feedback messages ────────────────────────── */}
        {errorMsg   && (
          <div className="feedback feedback--error"   style={{ marginBottom: 'var(--space-4)' }}>
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="feedback feedback--success" style={{ marginBottom: 'var(--space-4)' }}>
            {successMsg}
          </div>
        )}

        {/* ── Action buttons ───────────────────────────── */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <Link
            href={`/profile/${profile.username}`}
            className="btn btn--secondary"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            className="btn btn--primary"
            disabled={saving || !hasUnsaved}
            style={{ flex: 1, position: 'relative' }}
          >
            {saving ? (
              <>
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                {uploadingAvatar ? 'Uploading photo…' : 'Saving…'}
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>

        {/* Unsaved changes hint */}
        {hasUnsaved && !saving && (
          <p style={{
            textAlign:  'center',
            fontSize:   'var(--text-xs)',
            color:      'var(--color-text-muted)',
            marginTop:  'var(--space-3)',
          }}>
            You have unsaved changes.
          </p>
        )}

        {/* ── Danger zone ──────────────────────────────── */}
        <div style={{
          marginTop:    'var(--space-10)',
          padding:      'var(--space-5)',
          border:       '1px dashed rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <h3 style={{
            fontSize:     'var(--text-sm)',
            fontWeight:   'var(--weight-semibold)',
            color:        'var(--color-accent-red)',
            marginBottom: 'var(--space-2)',
          }}>
            Account Actions
          </h3>
          <p style={{
            fontSize:     'var(--text-xs)',
            color:        'var(--color-text-muted)',
            marginBottom: 'var(--space-4)',
          }}>
            Need to change your password or delete your account?
            Contact support or manage your account through the Supabase auth settings.
          </p>
          <Link
            href="/dashboard"
            className="btn btn--danger btn--sm"
          >
            Back to safety
          </Link>
        </div>

      </div>
    </main>
  );
}