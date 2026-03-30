import { useState, useEffect } from 'react';
import {
  LS_WORKOUTS,
  LS_SCHEDULE,
  LS_YOUTUBE_LINKS,
  LS_WORKOUT_LOGS,
  LS_TEMPLATES,
} from '../constants';

function buildMeta(currentView) {
  return {
    view: currentView,
    appVersion: 'v0.1.0',
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    standalone: window.matchMedia('(display-mode: standalone)').matches,
  };
}

function buildSnapshot() {
  const keys = [LS_WORKOUTS, LS_SCHEDULE, LS_YOUTUBE_LINKS, LS_WORKOUT_LOGS, LS_TEMPLATES];
  const snapshot = {};
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (raw) {
      try { snapshot[key] = JSON.parse(raw); } catch { snapshot[key] = raw; }
    }
  }
  return snapshot;
}

export default function FeedbackModal({ onClose, showToast, currentView }) {
  const [category, setCategory] = useState('Bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [includeSnapshot, setIncludeSnapshot] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, submitting]);

  async function handleSubmit() {
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    const payload = {
      title: title.trim(),
      category,
      description: description.trim(),
      meta: buildMeta(currentView),
      snapshot: category === 'Bug' && includeSnapshot ? buildSnapshot() : undefined,
    };
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onClose();
      showToast('Feedback sent — thank you!');
    } catch {
      showToast('Failed to send feedback — please try again', 'error');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => { if (!submitting) onClose(); }}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title">Send Feedback</h2>

        <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-sm)' }}>Category</p>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginBottom: 'var(--space-md)' }}>
          {['Bug', 'Feature', 'Other'].map((cat) => (
            <button
              key={cat}
              className={`btn btn-small ${category === cat ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setCategory(cat)}
              disabled={submitting}
            >
              {cat}
            </button>
          ))}
        </div>

        <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-sm)' }}>Title</p>
        <input
          type="text"
          placeholder="Brief summary…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={submitting}
          maxLength={120}
          style={{ marginBottom: 'var(--space-md)' }}
        />

        <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-sm)' }}>Description</p>
        <textarea
          placeholder="Describe the issue or feature request…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={submitting}
          rows={5}
          style={{ resize: 'vertical', fontFamily: 'inherit', marginBottom: 'var(--space-md)' }}
        />

        {category === 'Bug' && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              marginBottom: 'var(--space-md)',
            }}
          >
            <input
              type="checkbox"
              checked={includeSnapshot}
              onChange={(e) => setIncludeSnapshot(e.target.checked)}
              disabled={submitting}
            />
            Include app data snapshot (helps diagnose bugs)
          </label>
        )}

        <div className="modal__actions flex gap-md">
          <button
            className="btn btn-secondary flex-1"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary flex-1"
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !description.trim()}
          >
            {submitting ? 'Sending…' : 'Send Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}
