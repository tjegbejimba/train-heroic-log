import { useState, useMemo } from 'react';
import { BookOpen, Video, Upload, X, Check, AlertTriangle, Loader } from 'lucide-react';

const YOUTUBE_URL_RE = /https?:\/\/[^\s]*youtu[^\s]*/i;

/**
 * Fetch video title from YouTube oEmbed API (no API key needed).
 */
async function fetchVideoTitle(url) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.title || null;
  } catch {
    return null;
  }
}

/**
 * Score how well a video title matches an exercise name.
 * Returns 0-1 where 1 is a perfect match.
 */
function matchScore(videoTitle, exerciseName) {
  const vt = videoTitle.toLowerCase();
  const en = exerciseName.toLowerCase();
  // Exact substring match
  if (vt.includes(en)) return 1;
  // Check each word of the exercise name
  const words = en.split(/\s+/);
  const matched = words.filter((w) => vt.includes(w)).length;
  return matched / words.length;
}

/**
 * Find the best matching exercise for a video title.
 * Returns { name, score } or null if no reasonable match.
 */
function findBestMatch(videoTitle, exerciseNames) {
  let best = null;
  let bestScore = 0;
  for (const name of exerciseNames) {
    const score = matchScore(videoTitle, name);
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }
  return bestScore >= 0.5 ? { name: best, score: bestScore } : null;
}

/**
 * Extract YouTube URLs from pasted text (one per line).
 */
function extractUrls(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      // If line has a pipe, treat right side as URL
      if (line.includes('|')) {
        const idx = line.indexOf('|');
        return {
          url: line.slice(idx + 1).trim(),
          manualName: line.slice(0, idx).trim() || null,
        };
      }
      const match = line.match(YOUTUBE_URL_RE);
      return match ? { url: match[0], manualName: null } : { url: line, manualName: null };
    })
    .filter((e) => YOUTUBE_URL_RE.test(e.url));
}

export default function LibraryView({ workouts, youtubeLinks, setYouTubeLink }) {
  const [search, setSearch] = useState('');
  const [editingLink, setEditingLink] = useState(null);
  const [linkDraft, setLinkDraft] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkRows, setBulkRows] = useState(null); // [{ url, videoTitle, matchedExercise, status }]
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSaved, setBulkSaved] = useState(false);

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

  const exerciseNames = useMemo(
    () => exercises.map((e) => e.title),
    [exercises]
  );

  const handleBulkPreview = async () => {
    const entries = extractUrls(bulkText);
    if (entries.length === 0) return;

    setBulkLoading(true);
    setBulkSaved(false);

    const rows = await Promise.all(
      entries.map(async ({ url, manualName }) => {
        if (manualName) {
          // User provided name explicitly via pipe separator
          const isKnown = exerciseNames.some(
            (n) => n.toLowerCase() === manualName.toLowerCase()
          );
          return {
            url,
            videoTitle: manualName,
            matchedExercise: isKnown ? manualName : null,
            status: isKnown ? 'matched' : 'unmatched',
          };
        }
        const title = await fetchVideoTitle(url);
        if (!title) {
          return { url, videoTitle: null, matchedExercise: null, status: 'fetch-failed' };
        }
        const match = findBestMatch(title, exerciseNames);
        return {
          url,
          videoTitle: title,
          matchedExercise: match ? match.name : null,
          status: match ? (match.score >= 1 ? 'matched' : 'partial') : 'unmatched',
        };
      })
    );

    setBulkRows(rows);
    setBulkLoading(false);
  };

  const handleBulkMatchChange = (index, exerciseName) => {
    setBulkRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? { ...r, matchedExercise: exerciseName || null, status: exerciseName ? 'matched' : 'unmatched' }
          : r
      )
    );
  };

  const handleBulkSave = () => {
    if (!bulkRows) return;
    const valid = bulkRows.filter((r) => r.matchedExercise && r.url);
    valid.forEach((r) => setYouTubeLink(r.matchedExercise, r.url));
    setBulkSaved(true);
  };

  const handleBulkClose = () => {
    setShowBulkImport(false);
    setBulkText('');
    setBulkRows(null);
    setBulkSaved(false);
    setBulkLoading(false);
  };

  if (Object.keys(workouts).length === 0) {
    return (
      <div className="view library-view">
        <div className="library-view__header">
          <h1>Exercise Library</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon"><BookOpen size={48} /></div>
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

      <div className="library-view__actions" style={{ padding: '0 var(--space-lg)', marginBottom: 'var(--space-md)' }}>
        <button
          className="btn btn-secondary btn-small"
          onClick={() => setShowBulkImport(!showBulkImport)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Upload size={14} />
          Bulk Import YouTube Links
        </button>
      </div>

      {showBulkImport && (
        <div className="card" style={{ margin: '0 var(--space-lg)', marginBottom: 'var(--space-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600 }}>Bulk Import</h3>
            <button className="btn btn-secondary btn-small" onClick={handleBulkClose} style={{ padding: '4px' }}>
              <X size={16} />
            </button>
          </div>
          <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-sm)' }}>
            Paste YouTube URLs (one per line). Video titles will be fetched and matched to your exercises automatically.
          </p>
          <textarea
            className="input"
            rows={6}
            placeholder={`https://youtube.com/watch?v=...\nhttps://youtu.be/...\n\nOr use: Exercise Name | URL`}
            value={bulkText}
            onChange={(e) => { setBulkText(e.target.value); setBulkRows(null); setBulkSaved(false); }}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)', alignItems: 'center' }}>
            {!bulkRows && (
              <button
                className="btn btn-secondary btn-small"
                onClick={handleBulkPreview}
                disabled={!bulkText.trim() || bulkLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {bulkLoading && <Loader size={12} className="spin" />}
                {bulkLoading ? 'Fetching titles...' : 'Match Videos'}
              </button>
            )}
            {bulkRows && !bulkSaved && (() => {
              const count = bulkRows.filter((r) => r.matchedExercise).length;
              return (
                <>
                  <button
                    className="btn btn-primary btn-small"
                    onClick={handleBulkSave}
                    disabled={count === 0}
                  >
                    Save {count} Link{count !== 1 ? 's' : ''}
                  </button>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => { setBulkRows(null); setBulkSaved(false); }}
                  >
                    Re-match
                  </button>
                </>
              );
            })()}
            {bulkSaved && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-accent-green)', fontSize: 'var(--font-size-sm)' }}>
                <Check size={14} /> Saved!
              </span>
            )}
          </div>

          {bulkRows && (() => {
            // Build map of exercise -> indices to detect duplicates within this batch
            const exerciseCounts = {};
            bulkRows.forEach((r, i) => {
              if (r.matchedExercise) {
                if (!exerciseCounts[r.matchedExercise]) exerciseCounts[r.matchedExercise] = [];
                exerciseCounts[r.matchedExercise].push(i);
              }
            });

            return (
            <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {bulkRows.map((r, i) => {
                const isDuplicate = r.matchedExercise && exerciseCounts[r.matchedExercise]?.length > 1;
                const hasExisting = r.matchedExercise && youtubeLinks[r.matchedExercise];
                const hasWarning = isDuplicate || hasExisting;

                return (
                <div
                  key={i}
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    padding: 'var(--space-sm)',
                    borderRadius: '6px',
                    background: hasWarning ? 'rgba(255,204,0,0.08)' : r.matchedExercise ? 'rgba(48,209,88,0.08)' : 'rgba(255,204,0,0.08)',
                    border: '1px solid',
                    borderColor: hasWarning ? 'rgba(255,204,0,0.3)' : r.matchedExercise ? 'rgba(48,209,88,0.2)' : 'rgba(255,204,0,0.2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    {hasWarning ? (
                      <AlertTriangle size={12} style={{ color: 'var(--color-accent-yellow)', flexShrink: 0 }} />
                    ) : r.matchedExercise ? (
                      <Check size={12} style={{ color: 'var(--color-accent-green)', flexShrink: 0 }} />
                    ) : (
                      <AlertTriangle size={12} style={{ color: 'var(--color-accent-yellow)', flexShrink: 0 }} />
                    )}
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.videoTitle || 'Could not fetch title'}
                    </span>
                  </div>
                  {isDuplicate && (
                    <div style={{ fontSize: '11px', color: 'var(--color-accent-yellow)', marginBottom: '4px' }}>
                      Duplicate — multiple videos matched to "{r.matchedExercise}". Only the last one will be saved.
                    </div>
                  )}
                  {hasExisting && !isDuplicate && (
                    <div style={{ fontSize: '11px', color: 'var(--color-accent-yellow)', marginBottom: '4px' }}>
                      "{r.matchedExercise}" already has a link — this will overwrite it.
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="text-secondary" style={{ fontSize: '11px', flexShrink: 0 }}>Match:</span>
                    <select
                      className="input"
                      value={r.matchedExercise || ''}
                      onChange={(e) => handleBulkMatchChange(i, e.target.value)}
                      style={{ fontSize: '11px', padding: '4px 6px', flex: 1 }}
                    >
                      <option value="">— Select exercise —</option>
                      {exerciseNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-secondary" style={{ fontSize: '10px', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.url}
                  </div>
                </div>
                );
              })}
            </div>
            );
          })()}
        </div>
      )}

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
                          <Video size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />{link}
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
