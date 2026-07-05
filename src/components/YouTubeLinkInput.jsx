import { useEffect, useState } from 'react';
import { Check, Link as LinkIcon, Video, X } from 'lucide-react';

export function safeYouTubeHref(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(trimmed)) return null;
  const match = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i
  );
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}

export function isValidYouTubeUrl(value) {
  return !!safeYouTubeHref(value);
}

export default function YouTubeLinkInput({ url, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(url || '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEditing) setInputValue(url || '');
  }, [url, isEditing]);

  const handleSave = () => {
    const nextValue = inputValue.trim();
    if (nextValue) {
      if (!isValidYouTubeUrl(nextValue)) {
        setError('Paste a youtube.com or youtu.be URL.');
        return;
      }
      onSave(nextValue);
    } else {
      onSave(null);
    }
    setError('');
    setIsEditing(false);
  };

  const handleCancel = () => {
    setInputValue(url || '');
    setError('');
    setIsEditing(false);
  };

  return (
    <div className="youtube-link-input">
      {!isEditing ? (
        <div className="youtube-link-input__display">
          <div className="youtube-link-input__body">
            <div className="youtube-link-input__label">
              <Video size={14} />
              Reference video
            </div>
            {url ? (() => {
              const href = safeYouTubeHref(url);
              return href ? (
                <a
                  className="youtube-link-input__url"
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <LinkIcon size={13} />
                  <span>{url}</span>
                </a>
              ) : (
                <span className="youtube-link-input__url youtube-link-input__url--plain">
                  <LinkIcon size={13} />
                  <span>{url}</span>
                </span>
              );
            })() : (
              <p className="youtube-link-input__empty">No video linked yet.</p>
            )}
          </div>
          <button
            className="btn btn-secondary btn-small"
            onClick={() => {
              setIsEditing(true);
              setInputValue(url || '');
            }}
          >
            {url ? 'Edit' : 'Add'}
          </button>
        </div>
      ) : (
        <div className="youtube-link-input__editor">
          <label className="youtube-link-input__label" htmlFor="youtube-link-input">
            <Video size={14} />
            Reference video
          </label>
          <input
            id="youtube-link-input"
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (error) setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
            autoFocus
            aria-invalid={!!error}
            aria-describedby={error ? 'youtube-link-input-error' : undefined}
          />
          {error && (
            <p className="youtube-link-input__error" id="youtube-link-input-error">
              <X size={13} />
              {error}
            </p>
          )}
          <div className="youtube-link-input__actions">
            <button className="btn btn-secondary btn-small" onClick={handleCancel}>
              <X size={14} />
              Keep
            </button>
            <button className="btn btn-primary btn-small" onClick={handleSave}>
              <Check size={14} />
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
