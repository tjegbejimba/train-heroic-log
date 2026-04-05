import { useState } from 'react';
import YouTubeLinkInput from './YouTubeLinkInput';
import { formatSet, groupSets } from '../utils/formatters';
import { extractVideoId } from '../utils/youtube';

export default function ExerciseRow({
  blockLetter,
  exercise,
  youtubeLink,
  onYoutubeLinkChange,
  onExerciseNotesChange,
  isExpanded,
  onToggleExpand,
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(exercise.notes || '');
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
            {groupSets(exercise.sets).map(({ set, count }, i) => (
              <span key={i} className="text-blue">
                {i > 0 && ' • '}
                {formatSet(set, count)}
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
          <div className="exercise-row__notes mb-md">
            {editingNotes ? (
              <div className="exercise-row__notes-edit">
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Add coaching tips (e.g. rest 1 min, 8 each side, stay tight...)"
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-sm mt-sm">
                  <button
                    className="btn btn-primary btn-small"
                    onClick={() => {
                      onExerciseNotesChange(notesDraft);
                      setEditingNotes(false);
                    }}
                  >
                    Save
                  </button>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => {
                      setNotesDraft(exercise.notes || '');
                      setEditingNotes(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="exercise-row__notes-toggle"
                onClick={() => setEditingNotes(true)}
              >
                {exercise.notes ? (
                  <p className="text-secondary text-sm">{exercise.notes}</p>
                ) : (
                  <p className="text-secondary text-sm" style={{ opacity: 0.5 }}>
                    + Add exercise tips
                  </p>
                )}
              </button>
            )}
          </div>

          <YouTubeLinkInput
            url={youtubeLink}
            onSave={onYoutubeLinkChange}
          />

          {youtubeLink && (
            <div className="exercise-row__video mt-lg">
              <iframe
                width="100%"
                height="250"
                src={`https://www.youtube.com/embed/${extractVideoId(youtubeLink)}?mute=1`}
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

