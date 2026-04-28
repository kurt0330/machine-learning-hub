'use client';
// ── Article Upload Page ────────────────────────────────────

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useUser, useAuthGuard } from '../../../hooks/useUser';
import { formatFileSize } from '../../../lib/helpers';

const MAX_FILE_SIZE = 20 * 1024 * 1024;  // 20 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt'];

export default function UploadPage() {
  const router        = useRouter();
  const { user, profile, loading } = useUser();
  useAuthGuard(user, loading);

  // ── Form state ─────────────────────────────────────────
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [file,        setFile]        = useState(null);
  const [coverFile,   setCoverFile]   = useState(null);
  const [coverPreview,setCoverPreview]= useState(null);
  const [dragging,    setDragging]    = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');

  const fileInputRef  = useRef(null);
  const coverInputRef = useRef(null);

  // ── File validation ────────────────────────────────────
  function validateFile(f) {
    if (!f) return 'No file selected.';
    if (f.size > MAX_FILE_SIZE)
      return `File is too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`;
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext))
      return `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`;
    return null;
  }

  // ── Drag-and-drop handlers ─────────────────────────────
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (!dropped) return;
    const err = validateFile(dropped);
    if (err) { setError(err); return; }
    setError('');
    setFile(dropped);
  }, []);

  function handleFileSelect(e) {
    const selected = e.target.files[0];
    if (!selected) return;
    const err = validateFile(selected);
    if (err) { setError(err); return; }
    setError('');
    setFile(selected);
  }

  function handleCoverSelect(e) {
    const selected = e.target.files[0];
    if (!selected) return;
    if (!selected.type.startsWith('image/')) {
      setError('Cover must be an image file.');
      return;
    }
    setCoverFile(selected);
    setCoverPreview(URL.createObjectURL(selected));
  }

  function removeFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeCover() {
    setCoverFile(null);
    setCoverPreview(null);
    if (coverInputRef.current) coverInputRef.current.value = '';
  }

  // ── Upload handler ─────────────────────────────────────
  async function handleUpload() {
    setError('');
    setSuccess('');

    if (!title.trim()) { setError('Please enter a title.'); return; }
    if (!file)         { setError('Please select a file to upload.'); return; }
    if (!user)         { setError('You must be logged in.'); return; }

    setUploading(true);

    try {
      // 1. WAKE UP SESSION (Fixes the 10% hang)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error("Your session expired. Please log in again.");
      }

      setProgress(10); 

      // 2. Upload article file
      const fileExt      = file.name.split('.').pop();
      const safeTitle    = title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const filePath     = `${user.id}/${Date.now()}-${safeTitle}.${fileExt}`;

      const { error: storageError } = await supabase.storage
        .from('articles')
        .upload(filePath, file, { 
          upsert: false,
          cacheControl: '3600' 
        });

      if (storageError) throw new Error(storageError.message);
      setProgress(50);

      // 3. Upload cover image (optional)
      let coverPath = null;
      if (coverFile) {
        const coverExt  = coverFile.name.split('.').pop();
        const coverName = `${user.id}/covers/${Date.now()}.${coverExt}`;
        const { error: coverError } = await supabase.storage
          .from('articles')
          .upload(coverName, coverFile, { upsert: false });
        if (!coverError) coverPath = coverName;
      }
      setProgress(75);

      // 4. Insert record into articles table
      const { data: article, error: dbError } = await supabase
        .from('articles')
        .insert({
          author_id:   user.id,
          title:       title.trim(),
          description: description.trim() || null,
          file_url:    filePath,
          cover_url:   coverPath,
        })
        .select()
        .single();

      if (dbError) throw new Error(dbError.message);
      setProgress(100);

      // 5. Success and Refresh (Fixes the list update)
      setSuccess('Article uploaded successfully!');
      router.refresh(); 

      setTimeout(() => {
        router.push(`/articles/${article.id}`);
      }, 1200);

    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
      setProgress(0);
    } finally {
      setUploading(false);
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

  // ── Render ─────────────────────────────────────────────
  return (
    <main className="page">
      <div className="page-content--narrow" style={{ paddingTop: 'var(--space-10)' }}>

        {/* Page header */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h1 style={{
            fontSize:     'var(--text-xl)',
            fontWeight:   'var(--weight-bold)',
            color:        'var(--color-text-primary)',
            marginBottom: 'var(--space-2)',
          }}>
            Upload Article
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Share your research with the ML-Hub community.
          </p>
        </div>

        <div className="card" style={{ padding: 'var(--space-8)' }}>

          {/* ── Title ──────────────────────────────────── */}
          <div className="form-group">
            <label className="form-label">Article Title *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Introduction to Transformer Models"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={150}
            />
            <span className="form-hint">{title.length}/150 characters</span>
          </div>

          {/* ── Description ────────────────────────────── */}
          <div className="form-group">
            <label className="form-label">Description <span style={{ color: 'var(--color-text-muted)' }}>(optional)</span></label>
            <textarea
              className="form-input form-textarea"
              placeholder="A short summary of what this article covers…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <span className="form-hint">{description.length}/500 characters</span>
          </div>

          {/* ── Cover Image ────────────────────────────── */}
          <div className="form-group">
            <label className="form-label">Cover Image <span style={{ color: 'var(--color-text-muted)' }}>(optional)</span></label>

            {coverPreview ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={coverPreview}
                  alt="Cover preview"
                  style={{
                    width:        '100%',
                    maxHeight:    '180px',
                    objectFit:    'cover',
                    borderRadius: 'var(--radius-md)',
                    border:       '1px solid var(--color-border-default)',
                  }}
                />
                <button
                  onClick={removeCover}
                  className="btn btn--danger btn--sm"
                  style={{ position: 'absolute', top: 'var(--space-2)', right: 'var(--space-2)' }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          'var(--space-2)',
                  background:   'var(--color-bg-elevated)',
                  border:       '1px dashed var(--color-border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding:      'var(--space-3) var(--space-4)',
                  color:        'var(--color-text-muted)',
                  fontSize:     'var(--text-sm)',
                  cursor:       'pointer',
                  transition:   'border-color var(--transition-fast)',
                  width:        '100%',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-border-hover)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border-default)'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                Add cover image
              </button>
            )}
            <input ref={coverInputRef} type="file" accept="image/*"
              onChange={handleCoverSelect} style={{ display: 'none' }} />
          </div>

          {/* ── File Drop Zone ──────────────────────────── */}
          <div className="form-group">
            <label className="form-label">Article File *</label>

            {file ? (
              /* Selected file preview */
              <div style={{
                display:      'flex',
                alignItems:   'center',
                gap:          'var(--space-4)',
                padding:      'var(--space-4)',
                background:   'var(--color-bg-elevated)',
                border:       '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{
                  width:          '44px',
                  height:         '44px',
                  borderRadius:   'var(--radius-sm)',
                  background:     'var(--color-accent-blue-dim)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                  fontSize:       'var(--text-xs)',
                  fontWeight:     'var(--weight-bold)',
                  color:          'var(--color-accent-blue)',
                  letterSpacing:  'var(--tracking-wide)',
                }}>
                  {file.name.split('.').pop().toUpperCase()}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <p style={{
                    fontSize:     'var(--text-sm)',
                    fontWeight:   'var(--weight-medium)',
                    color:        'var(--color-text-primary)',
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                  }}>
                    {file.name}
                  </p>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <button
                  onClick={removeFile}
                  className="btn btn--ghost btn--icon"
                  style={{ color: 'var(--color-accent-red)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>

            ) : (
              /* Drop zone */
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border:         `2px dashed ${dragging
                    ? 'var(--color-accent-blue)'
                    : 'var(--color-border-default)'}`,
                  borderRadius:   'var(--radius-lg)',
                  padding:        'var(--space-12) var(--space-6)',
                  textAlign:      'center',
                  cursor:         'pointer',
                  background:     dragging
                    ? 'var(--color-accent-blue-dim)'
                    : 'var(--color-bg-elevated)',
                  transition:     'all var(--transition-base)',
                }}
              >
                <div style={{
                  width:          '48px',
                  height:         '48px',
                  borderRadius:   'var(--radius-md)',
                  background:     'var(--color-bg-overlay)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  margin:         '0 auto var(--space-4)',
                  border:         '1px solid var(--color-border-default)',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                    stroke="var(--color-text-muted)" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <p style={{
                  fontSize:     'var(--text-sm)',
                  fontWeight:   'var(--weight-medium)',
                  color:        'var(--color-text-primary)',
                  marginBottom: 'var(--space-1)',
                }}>
                  {dragging ? 'Drop your file here' : 'Drag & drop your file here'}
                </p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  or click to browse — PDF, DOC, DOCX, TXT · Max {formatFileSize(MAX_FILE_SIZE)}
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_EXTENSIONS.join(',')}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>

          {/* ── Progress bar ────────────────────────────── */}
          {uploading && (
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <div style={{
                display:         'flex',
                justifyContent:  'space-between',
                marginBottom:    'var(--space-2)',
                fontSize:        'var(--text-xs)',
                color:           'var(--color-text-muted)',
              }}>
                <span>Uploading…</span>
                <span>{progress}%</span>
              </div>
              <div style={{
                height:       '4px',
                background:   'var(--color-bg-overlay)',
                borderRadius: 'var(--radius-full)',
                overflow:     'hidden',
              }}>
                <div style={{
                  height:       '100%',
                  width:        `${progress}%`,
                  background:   'var(--color-accent-blue)',
                  borderRadius: 'var(--radius-full)',
                  transition:   'width 0.4s ease',
                }} />
              </div>
            </div>
          )}

          {/* ── Feedback ────────────────────────────────── */}
          {error   && <div className="feedback feedback--error"   style={{ marginBottom: 'var(--space-5)' }}>{error}</div>}
          {success && <div className="feedback feedback--success" style={{ marginBottom: 'var(--space-5)' }}>{success}</div>}

          {/* ── Actions ─────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button
              onClick={() => router.back()}
              className="btn btn--secondary"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              className="btn btn--primary"
              disabled={uploading || !file || !title.trim()}
              style={{ flex: 1 }}
            >
              {uploading
                ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Uploading…</>
                : 'Publish Article'
              }
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}