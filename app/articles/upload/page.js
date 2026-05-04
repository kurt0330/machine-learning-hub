'use client';
// ── Article Upload Page (Text-based) ───────────────────────
// Pivoted from PDF upload to rich text content entry.
// Inserts into articles table: author_id, title, description,
// content, cover_url. Notification broadcast is handled by
// the handle_new_article_notification() SQL trigger.

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useUser, useAuthGuard } from '../../../hooks/useUser';

const MAX_COVER_SIZE   = 5 * 1024 * 1024; // 5 MB
const MIN_CONTENT_LEN  = 10;
const MAX_TITLE_LEN    = 150;
const MAX_DESC_LEN     = 500;

export default function UploadPage() {
  const router                     = useRouter();
  const { user, profile, loading } = useUser();
  useAuthGuard(user, loading);

  // ── Form state ─────────────────────────────────────────
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [content,     setContent]     = useState('');
  const [coverFile,   setCoverFile]   = useState(null);
  const [coverPreview,setCoverPreview]= useState(null);
  const [draggingCover, setDraggingCover] = useState(false);

  // ── UI state ───────────────────────────────────────────
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const coverInputRef = useRef(null);

  // ── Email confirmation guard ───────────────────────────
  // Supabase sets email_confirmed_at when user confirms email.
  function isEmailConfirmed() {
    return !!(user?.email_confirmed_at || user?.confirmed_at);
  }

  // ── Cover image handlers ───────────────────────────────
  function handleCoverSelect(e) {
    const file = e.target.files?.[0];
    processCoverFile(file);
  }

  const handleCoverDragOver = useCallback((e) => {
    e.preventDefault();
    setDraggingCover(true);
  }, []);

  const handleCoverDragLeave = useCallback((e) => {
    e.preventDefault();
    setDraggingCover(false);
  }, []);

  const handleCoverDrop = useCallback((e) => {
    e.preventDefault();
    setDraggingCover(false);
    const file = e.dataTransfer.files?.[0];
    processCoverFile(file);
  }, []);

  function processCoverFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Cover must be an image file (JPG, PNG, WebP, GIF).');
      return;
    }
    if (file.size > MAX_COVER_SIZE) {
      setError('Cover image must be under 5 MB.');
      return;
    }
    setError('');
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  function removeCover() {
    setCoverFile(null);
    setCoverPreview(null);
    if (coverInputRef.current) coverInputRef.current.value = '';
  }

  // ── Validation ─────────────────────────────────────────
  function validate() {
    const errors = {};
    if (!title.trim())
      errors.title = 'Title is required.';
    else if (title.trim().length > MAX_TITLE_LEN)
      errors.title = `Title must be ${MAX_TITLE_LEN} characters or fewer.`;

    if (description.trim().length > MAX_DESC_LEN)
      errors.description = `Description must be ${MAX_DESC_LEN} characters or fewer.`;

    if (!content.trim())
      errors.content = 'Article content is required.';
    else if (content.trim().length < MIN_CONTENT_LEN)
      errors.content = `Content must be at least ${MIN_CONTENT_LEN} characters.`;

    return errors;
  }

  // ── Submit ─────────────────────────────────────────────
  async function handleSubmit() {
    setError('');
    setFieldErrors({});

    // ── Email confirmation check ─────────────────────────
    if (!isEmailConfirmed()) {
      setError(
        'Please confirm your email address before publishing. ' +
        'Check your inbox for the confirmation link.'
      );
      return;
    }

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      // 1. Upload cover image to Supabase Storage (optional)
      let coverUrl = null;
      if (coverFile) {
        const ext      = coverFile.name.split('.').pop();
        const filePath = `${user.id}/covers/${Date.now()}.${ext}`;

        const { error: coverError } = await supabase.storage
          .from('articles')
          .upload(filePath, coverFile, { upsert: false });

        if (coverError) throw new Error(`Cover upload failed: ${coverError.message}`);
        coverUrl = filePath;
      }

      // 2. Insert article row
      // Columns: author_id, title, description, content, cover_url
      const { data: article, error: insertError } = await supabase
        .from('articles')
        .insert({
          author_id:   user.id,          // articles table uses author_id
          title:       title.trim(),
          description: description.trim() || null,
          content:     content.trim(),
          cover_url:   coverUrl,
        })
        .select('id')
        .single();

      if (insertError) throw new Error(insertError.message);

      // 3. Notification broadcast is handled automatically by the
      //    handle_new_article_notification() SQL trigger — no client call needed.

      // 4. Redirect to the new article
      router.push(`/articles/${article.id}`);

    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading guard ──────────────────────────────────────
  if (loading) {
    return (
      <main className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </main>
    );
  }

  const wordCount    = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount    = content.length;
  const canSubmit    = title.trim() && content.trim().length >= MIN_CONTENT_LEN && !submitting;

  return (
    <main className="page">
      <div className="page-content--narrow" style={{ paddingTop: 'var(--space-10)' }}>

        {/* ── Page header ─────────────────────────────── */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h1 style={{
            fontSize:     'var(--text-xl)',
            fontWeight:   'var(--weight-bold)',
            color:        'var(--color-text-primary)',
            marginBottom: 'var(--space-2)',
          }}>
            Write an Article
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Share your knowledge with the ML-Hub community.
          </p>
        </div>

        {/* ── Email confirmation warning ───────────────── */}
        {user && !isEmailConfirmed() && (
          <div className="feedback feedback--info" style={{ marginBottom: 'var(--space-6)' }}>
            ⚠️ Your email address is not yet confirmed. You won&apos;t be able to publish
            until you verify your email. Check your inbox for the confirmation link.
          </div>
        )}

        <div className="card" style={{ padding: 'var(--space-8)' }}>

          {/* ── Cover Image ────────────────────────────── */}
          <div className="form-group">
            <label className="form-label">
              Cover Image{' '}
              <span style={{ color: 'var(--color-text-muted)', textTransform: 'none', letterSpacing: 0 }}>
                (optional)
              </span>
            </label>

            {coverPreview ? (
              <div style={{ position: 'relative' }}>
                <img
                  src={coverPreview}
                  alt="Cover preview"
                  style={{
                    width:        '100%',
                    height:       '200px',
                    objectFit:    'cover',
                    borderRadius: 'var(--radius-lg)',
                    border:       '1px solid var(--color-border-default)',
                    display:      'block',
                  }}
                />
                <button
                  onClick={removeCover}
                  className="btn btn--danger btn--sm"
                  style={{
                    position: 'absolute',
                    top:      'var(--space-3)',
                    right:    'var(--space-3)',
                  }}
                >
                  ✕ Remove
                </button>
              </div>
            ) : (
              <div
                onDragOver={handleCoverDragOver}
                onDragLeave={handleCoverDragLeave}
                onDrop={handleCoverDrop}
                onClick={() => coverInputRef.current?.click()}
                style={{
                  border:         `2px dashed ${draggingCover ? 'var(--color-accent-blue)' : 'var(--color-border-default)'}`,
                  borderRadius:   'var(--radius-lg)',
                  padding:        'var(--space-8)',
                  textAlign:      'center',
                  cursor:         'pointer',
                  background:     draggingCover ? 'var(--color-accent-blue-dim)' : 'var(--color-bg-elevated)',
                  transition:     'all var(--transition-base)',
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                  stroke="var(--color-text-muted)" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ margin: '0 auto var(--space-3)', display: 'block' }}>
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                  {draggingCover ? 'Drop image here' : 'Drag & drop a cover image'}
                </p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  or click to browse · JPG, PNG, WebP · Max 5 MB
                </p>
              </div>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverSelect}
              style={{ display: 'none' }}
            />
          </div>

          {/* ── Title ──────────────────────────────────── */}
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input
              type="text"
              className={`form-input ${fieldErrors.title ? 'form-input--error' : ''}`}
              placeholder="Give your article a clear, descriptive title…"
              value={title}
              onChange={e => {
                setTitle(e.target.value);
                setFieldErrors(prev => ({ ...prev, title: '' }));
              }}
              maxLength={MAX_TITLE_LEN}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {fieldErrors.title
                ? <span className="form-hint" style={{ color: 'var(--color-accent-red)' }}>{fieldErrors.title}</span>
                : <span className="form-hint">Make it count — this is the first thing readers see.</span>
              }
              <span className="form-hint" style={{
                color: title.length > 130 ? 'var(--color-accent-amber)' : 'var(--color-text-muted)',
              }}>
                {title.length}/{MAX_TITLE_LEN}
              </span>
            </div>
          </div>

          {/* ── Description ────────────────────────────── */}
          <div className="form-group">
            <label className="form-label">
              Summary{' '}
              <span style={{ color: 'var(--color-text-muted)', textTransform: 'none', letterSpacing: 0 }}>
                (optional)
              </span>
            </label>
            <textarea
              className={`form-input form-textarea ${fieldErrors.description ? 'form-input--error' : ''}`}
              placeholder="A one or two sentence summary shown in the feed preview…"
              value={description}
              onChange={e => {
                setDescription(e.target.value);
                setFieldErrors(prev => ({ ...prev, description: '' }));
              }}
              rows={2}
              maxLength={MAX_DESC_LEN}
              style={{ resize: 'vertical', minHeight: '70px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {fieldErrors.description
                ? <span className="form-hint" style={{ color: 'var(--color-accent-red)' }}>{fieldErrors.description}</span>
                : <span className="form-hint">Shown as the preview in the feed.</span>
              }
              <span className="form-hint">{description.length}/{MAX_DESC_LEN}</span>
            </div>
          </div>

          {/* ── Content ────────────────────────────────── */}
          <div className="form-group">
            <label className="form-label">Content *</label>
            <textarea
              className={`form-input form-textarea ${fieldErrors.content ? 'form-input--error' : ''}`}
              placeholder="Write your article here. You can use plain text or Markdown (# Heading, **bold**, *italic*, - lists)…"
              value={content}
              onChange={e => {
                setContent(e.target.value);
                setFieldErrors(prev => ({ ...prev, content: '' }));
              }}
              rows={18}
              style={{ resize: 'vertical', minHeight: '360px', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', lineHeight: '1.7' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {fieldErrors.content
                ? <span className="form-hint" style={{ color: 'var(--color-accent-red)' }}>{fieldErrors.content}</span>
                : <span className="form-hint">Min {MIN_CONTENT_LEN} characters. Markdown is supported.</span>
              }
              <span className="form-hint" style={{
                color: charCount < MIN_CONTENT_LEN ? 'var(--color-accent-red)' : 'var(--color-text-muted)',
              }}>
                {wordCount} words · {charCount} chars
              </span>
            </div>
          </div>

          {/* ── Global error ─────────────────────────────  */}
          {error && (
            <div className="feedback feedback--error" style={{ marginBottom: 'var(--space-5)' }}>
              {error}
            </div>
          )}

          {/* ── Actions ─────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            <button
              onClick={() => router.back()}
              className="btn btn--secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="btn btn--primary"
              disabled={!canSubmit}
              style={{ flex: 1 }}
            >
              {submitting
                ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Publishing…</>
                : 'Publish Article'
              }
            </button>
          </div>

          {/* Draft hint */}
          <p style={{
            textAlign:  'center',
            fontSize:   'var(--text-xs)',
            color:      'var(--color-text-muted)',
            marginTop:  'var(--space-4)',
          }}>
            Articles are published immediately and visible to all users.
          </p>
        </div>
      </div>
    </main>
  );
}