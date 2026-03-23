import { useState, useMemo } from 'react';

export default function LibraryView({ workouts, youtubeLinks, setYouTubeLink }) {
  const [search, setSearch] = useState('');
  const [editingLink, setEditingLink] = useState(null);
  const [linkDraft, setLinkDraft] = useState('');

  // Build flat list of exercises with metadata
  const exercises = useMemo(() => {
    const exerciseMap = {};

    Object.entries(workouts).forEach(([workoutTitle, workout]) => {
      workout.blocks.forEach((block) => {
        block.exercises.forEach((exercise) => {
          const name = exercise.title;
          if (!exerciseMap[name]) {
            exerciseMap[name] = {
              title: name,
              workoutCount: 0,
              workoutNames: new Set(),
              totalSets: 0,
            };
          }
          exerciseMap[name].workoutCount++;
          exerciseMap[name].workoutNames.add(workoutTitle);
          exerciseMap[name].totalSets += exercise.sets.length;
        });
      });
    });

    return Object.values(exerciseMap).sort((a, b) =>
      a.title.localeCompare(b.title)
    );
  }, [workouts]);

  const filtered = useMemo(() => {
    if (!search.trim()) return exercises;
    const q = search.toLowerCase();
    return exercises.filter((ex) => ex.title.toLowerCase().includes(q));
  }, [exercises, search]);

  const handleSaveLink = (exerciseTitle) => {
    setYouTubeLink(exerciseTitle, linkDraft.trim());
    setEditingLink(null);
    setLinkDraft('');
  };

  const handleStartEdit = (exerciseTitle) => {
    setEditingLink(exerciseTitle);
    setLinkDraft(youtubeLinks[exerciseTitle] || '');
  };

  if (Object.keys(workouts).length === 0) {
    return (
      <div className="view library-view">
        <div className="library-view__header">
          <h1>Exercise Library</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <h3>No exercises yet</h3>
          <p className="text-secondary">Import a workout to populate your library</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view library-view">
      <div className="library-view__header">
        <h1>Exercise Library</h1>
        <p className="text-secondary text-sm">
          {exercises.length} exercise{exercises.length !== 1 ? 's' : ''} across{' '}
          {Object.keys(workouts).length} workout
          {Object.keys(workouts).length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="library-view__search">
        <input
          type="text"
          className="input"
          placeholder="Search exercises..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="library-view__list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p className="text-secondary">No exercises match "{search}"</p>
          </div>
        ) : (
          filtered.map((exercise) => {
            const link = youtubeLinks[exercise.title];
            const isEditing = editingLink === exercise.title;

            return (
              <div key={exercise.title} className="library-card card">
                <div className="library-card__header">
                  <div className="library-card__info">
                    <h3 className="library-card__title">{exercise.title}</h3>
                    <div className="library-card__meta">
                      <span>
                        {exercise.workoutNames.size} workout
                        {exercise.workoutNames.size !== 1 ? 's' : ''}
                      </span>
                      <span className="library-card__dot"></span>
                      <span>{exercise.totalSets} total sets</span>
                    </div>
                    <div className="library-card__workouts">
                      {[...exercise.workoutNames].map((name) => (
                        <span key={name} className="library-card__tag">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="library-card__link-section">
                  {isEditing ? (
                    <div className="library-card__link-edit">
                      <input
                        type="url"
                        className="input"
                        placeholder="YouTube URL..."
                        value={linkDraft}
                        onChange={(e) => setLinkDraft(e.target.value)}
                        autoFocus
                      />
                      <div className="library-card__link-actions">
                        <button
                          className="btn btn-primary btn-small"
                          onClick={() => handleSaveLink(exercise.title)}
                        >
                          Save
                        </button>
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={() => {
                            setEditingLink(null);
                            setLinkDraft('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="library-card__link-display">
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="library-card__link-url"
                        >
                          🎥 {link}
                        </a>
                      ) : (
                        <span className="text-secondary text-sm">
                          No video linked
                        </span>
                      )}
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => handleStartEdit(exercise.title)}
                      >
                        {link ? 'Edit' : 'Add Link'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
