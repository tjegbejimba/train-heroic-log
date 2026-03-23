import { useState } from 'react';

export default function YouTubeLinkInput({ url, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(url || '');

  const handleSave = () => {
    if (inputValue.trim()) {
      if (!inputValue.includes('youtube.com') && !inputValue.includes('youtu.be')) {
        alert('Please enter a valid YouTube URL');
        return;
      }
      onSave(inputValue.trim());
    } else {
      onSave(null);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setInputValue(url || '');
    setIsEditing(false);
  };

  return (
    <div className="youtube-link-input">
      {!isEditing ? (
        <div className="flex-between">
          <div className="flex-1">
            <div className="text-blue text-sm">🎥 YouTube Link</div>
            {url ? (
              <p className="text-secondary text-sm truncate mt-xs">{url}</p>
            ) : (
              <p className="text-secondary text-sm mt-xs">No link added</p>
            )}
          </div>
          <button
            className="btn btn-secondary btn-small"
            onClick={() => {
              setIsEditing(true);
              setInputValue(url || '');
            }}
          >
            Edit
          </button>
        </div>
      ) : (
        <div>
          <input
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoFocus
          />
          <div className="flex gap-sm mt-md">
            <button className="btn btn-secondary flex-1" onClick={handleCancel}>
              Cancel
            </button>
            <button className="btn btn-primary flex-1" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
