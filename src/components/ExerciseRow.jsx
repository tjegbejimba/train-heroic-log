import { useState } from 'react';
import YouTubeLinkInput from './YouTubeLinkInput';
import { formatSet } from '../csv/exerciseData';

export default function ExerciseRow({
  blockLetter,
  exercise,
  youtubeLink,
  onYoutubeLinkChange,
  isExpanded,
  onToggleExpand,
}) {
  return (
    <div className={`exercise-row ${isExpanded ? 'exercise-row--expanded' : ''}`}>
      <button
        className="exercise-row__toggle"
        onClick={onToggleExpand}
      >
        <div className="exercise-row__badge">{blockLetter}</div>
        <div className="exercise-row__info">
          <h3 className="exercise-row__title">{exercise.title}</h3>
          <div className="exercise-row__sets">
            {exercise.sets.map((set, i) => (
              <span key={i} className="text-blue">
                {i > 0 && ' • '}
                {formatSet(set)}
              </span>
            ))}
          </div>
        </div>
        <span className="exercise-row__expand-icon">
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>

      {isExpanded && (
        <div className="exercise-row__details">
          {exercise.notes && (
            <div className="mb-md">
              <p className="text-secondary text-sm">{exercise.notes}</p>
            </div>
          )}

          <YouTubeLinkInput
            url={youtubeLink}
            onSave={onYoutubeLinkChange}
          />

          {youtubeLink && (
            <div className="exercise-row__video mt-lg">
              <iframe
                width="100%"
                height="250"
                src={`https://www.youtube.com/embed/${extractVideoId(youtubeLink)}`}
                title={exercise.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function extractVideoId(url) {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return '';
}
