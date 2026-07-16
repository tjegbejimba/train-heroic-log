import { useState, useMemo, useEffect, useRef } from 'react';
import { AlertTriangle, BookOpen, Check, ChevronDown, ChevronRight, Layers3, Loader, Play, Search, Upload, X } from 'lucide-react';
import YouTubeLinkInput, { isValidYouTubeUrl } from '../components/YouTubeLinkInput';
import TemplateListView from './TemplateListView';

const YOUTUBE_URL_RE = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/[^\s]*/i;

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
export function extractUrls(text) {
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
    .filter((e) => isValidYouTubeUrl(e.url));
}

/** Format set summary: "4x8 @ 135lb" or just "3 sets" */
function formatSetSummary(exercise) {
  const sets = exercise.sets || [];
  if (sets.length === 0) return null;
  const first = sets[0];
  const allSame = sets.every(
    (s) => s.reps === first.reps && s.weight === first.weight
  );
  if (allSame && first.reps && first.weight) {
    return `${sets.length}x${first.reps} @ ${first.weight}${first.unit || 'lb'}`;
  }
  if (allSame && first.reps) {
    return `${sets.length}x${first.reps}`;
  }
  return `${sets.length} set${sets.length !== 1 ? 's' : ''}`;
}

export default function LibraryView({ workouts, youtubeLinks, setYouTubeLink, setManyYouTubeLinks, onUpdateExerciseNotes, onExerciseTap, onInlineEditorChange, templateList = [], deleteTemplate, navigate, initialTab, onTabChange }) {
  const [tab, setTabState] = useState(initialTab === 'templates' ? 'templates' : 'exercises');
  const setTab = (next) => {
    setTabState(next);
    onTabChange?.(next);
  };
  const [search, setSearch] = useState('');
  const [expandedExercise, setExpandedExercise] = useState(null);
  const [editingNotes, setEditingNotes] = useState(null);
  
  // Notify parent when inline editor state changes
  useEffect(() => {
    onInlineEditorChange?.(editingNotes !== null);
  }, [editingNotes, onInlineEditorChange]);
  const [notesDraft, setNotesDraft] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkRows, setBulkRows] = useState(null); // [{ url, videoTitle, matchedExercise, status }]
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSaved, setBulkSaved] = useState(false);
  const [preImportLinks, setPreImportLinks] = useState(null);

  // Ref map to track action rows for scroll behavior
  const actionRowRefs = useRef({});

  // Scroll action row into view when editing starts (mobile fix for bottom nav overlap)
  useEffect(() => {
    if (editingNotes && actionRowRefs.current[editingNotes]) {
      // Small delay to ensure DOM has updated with the expanded editor
      setTimeout(() => {
        actionRowRefs.current[editingNotes]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }, 50);
    }
  }, [editingNotes]);

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
              notes: exercise.notes || '',
              sets: exercise.sets || [],
              _allNotes: new Set(),
            };
          }
          if (exercise.notes) exerciseMap[name]._allNotes.add(exercise.notes);
          if (!exerciseMap[name].notes && exercise.notes) {
            exerciseMap[name].notes = exercise.notes;
          }
          // Keep sets from first occurrence
          if (exerciseMap[name].sets.length === 0 && exercise.sets?.length > 0) {
            exerciseMap[name].sets = exercise.sets;
          }
        });
      });
    });

    return Object.values(exerciseMap)
      .map(({ _allNotes, ...ex }) => ({
        ...ex,
        hasConflictedNotes: _allNotes.size > 1,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [workouts]);

  const filtered = useMemo(() => {
    if (!search.trim()) return exercises;
    const q = search.toLowerCase();
    return exercises.filter((ex) => ex.title.toLowerCase().includes(q));
  }, [exercises, search]);

  const exerciseNames = useMemo(
    () => exercises.map((e) => e.title),
    [exercises]
  );

  const handleBulkPreview = async () => {
    const entries = extractUrls(bulkText);
    if (entries.length === 0) return;

    setBulkLoading(true);
    setBulkSaved(false);
    setPreImportLinks({ ...youtubeLinks });

    const rows = await Promise.all(
      entries.map(async ({ url, manualName }) => {
        if (manualName) {
          const canonicalName = exerciseNames.find(
            (n) => n.toLowerCase() === manualName.toLowerCase()
          ) || null;
          return {
            url,
            videoTitle: manualName,
            matchedExercise: canonicalName,
            status: canonicalName ? 'matched' : 'unmatched',
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
    const skipped = bulkRows.length - valid.length;
    setManyYouTubeLinks(valid.map((r) => ({ key: r.matchedExercise, url: r.url })));
    setBulkSaved({ saved: valid.length, skipped });
  };

  const handleBulkClose = () => {
    setShowBulkImport(false);
    setBulkText('');
    setBulkRows(null);
    setBulkSaved(false);
    setBulkLoading(false);
    setPreImportLinks(null);
  };

  const hasWorkouts = Object.keys(workouts).length > 0;

  return (
    <div className="view library-view">
      <div className="library-view__header">
        <div>
          <h1>Library</h1>
          <p className="library-view__subtitle">
            {tab === 'exercises'
              ? 'Search, tune form notes, and attach reference videos before the next session.'
              : 'Reusable workouts you can drop onto any day in the planner.'}
          </p>
        </div>
        <div
          className="library-view__metric"
          aria-label={tab === 'exercises' ? `${exercises.length} exercises` : `${templateList.length} templates`}
        >
          <span>{tab === 'exercises' ? exercises.length : templateList.length}</span>
          <small>{tab === 'exercises' ? 'exercises' : 'templates'}</small>
        </div>
      </div>

      <div className="library-view__tabs" role="tablist" aria-label="Library sections">
        <button
          role="tab"
          aria-selected={tab === 'exercises'}
          className={`library-view__tab ${tab === 'exercises' ? 'library-view__tab--active' : ''}`}
          onClick={() => setTab('exercises')}
        >
          <BookOpen size={15} />
          Exercises
        </button>
        <button
          role="tab"
          aria-selected={tab === 'templates'}
          className={`library-view__tab ${tab === 'templates' ? 'library-view__tab--active' : ''}`}
          onClick={() => setTab('templates')}
        >
          <Layers3 size={15} />
          Templates
        </button>
      </div>

      {tab === 'templates' ? (
        <TemplateListView
          templateList={templateList}
          deleteTemplate={deleteTemplate}
          navigate={navigate}
          embedded
        />
      ) : !hasWorkouts ? (
        <div className="empty-state">
          <div className="empty-state-icon"><BookOpen size={48} /></div>
          <h3>No exercises yet</h3>
          <p className="text-secondary">Import a workout to populate your library</p>
        </div>
      ) : (
        <>
      <div className="library-view__search-bar">
        <Search size={16} className="library-view__search-icon" />
        <input
          type="text"
          className="library-view__search-input"
          placeholder="Search exercises..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="library-view__search-clear"
            onClick={() => setSearch('')}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="library-view__list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p className="text-secondary">No exercises match "{search}"</p>
          </div>
        ) : (
          filtered.map((exercise) => {
            const link = youtubeLinks[exercise.title];
            const isExpanded = expandedExercise === exercise.title;
            const setSummary = formatSetSummary(exercise);

            return (
              <div key={exercise.title} className={`library-row ${isExpanded ? 'library-row--expanded' : ''}`}>
                {/* Collapsed row */}
                <button
                  className="library-row__header"
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpandedExercise(isExpanded ? null : exercise.title)
                  }
                >
                  <div className="library-row__info">
                    <span className="library-row__title">{exercise.title}</span>
                    {setSummary && (
                      <span className="library-row__set-summary">{setSummary}</span>
                    )}
                  </div>
                  <div className="library-row__right">
                    {link && (
                      <span className="library-row__yt-indicator" aria-label="Has YouTube link">
                        <Play size={12} />
                      </span>
                    )}
                    <span className="library-row__chevron">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="library-row__details">
                    <button
                      className="library-row__history-btn"
                      onClick={() => onExerciseTap(exercise.title)}
                    >
                      View exercise history
                      <ChevronRight size={14} />
                    </button>

                    {exercise.sets && exercise.sets.length > 0 && (
                      <div className="library-row__sets">
                        <div className="library-row__sets-label">Sets</div>
                        {exercise.sets.map((set, idx) => (
                          <div key={idx} className="library-row__set-row">
                            <span className="text-secondary">{idx + 1}</span>
                            <span>
                              {set.reps ? `${set.reps} reps` : '--'}
                              {set.weight ? ` @ ${set.weight}${set.unit || 'lb'}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="library-row__notes-section">
                      <div className="library-row__section-label">Form Notes</div>
                      {editingNotes === exercise.title ? (
                        <div className="library-row__notes-edit">
                          {exercise.hasConflictedNotes && (
                            <div className="library-row__conflict-warn">
                              <AlertTriangle size={12} />
                              Notes differ across workouts - saving will overwrite all instances.
                            </div>
                          )}
                          <textarea
                            className="input"
                            rows={3}
                            placeholder="Add coaching tips (e.g. rest 1 min, 8 each side, stay tight...)"
                            value={notesDraft}
                            onChange={(e) => setNotesDraft(e.target.value)}
                            autoFocus
                          />
                          <div
                            className="library-row__actions"
                            ref={el => actionRowRefs.current[exercise.title] = el}
                          >
                            <button
                              className="btn btn-primary btn-small"
                              onClick={() => {
                                onUpdateExerciseNotes(exercise.title, notesDraft);
                                setEditingNotes(null);
                                setNotesDraft('');
                              }}
                            >
                              Save
                            </button>
                            <button
                              className="btn btn-secondary btn-small"
                              onClick={() => {
                                setEditingNotes(null);
                                setNotesDraft('');
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="library-row__notes-toggle"
                          onClick={() => {
                            setEditingNotes(exercise.title);
                            setNotesDraft(exercise.notes || '');
                          }}
                        >
                          {exercise.notes ? (
                            <p className="text-secondary text-sm">{exercise.notes}</p>
                          ) : (
                            <p className="text-secondary text-sm library-row__notes-placeholder">
                              + Add form notes
                            </p>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="library-row__link-section">
                      <YouTubeLinkInput
                        url={link}
                        onSave={(nextUrl) => setYouTubeLink(exercise.title, nextUrl)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="library-view__bulk-section">
      <div className="library-view__actions">
        <button
          className="btn btn-secondary btn-small library-view__bulk-trigger"
          onClick={() => setShowBulkImport(!showBulkImport)}
        >
          <Upload size={14} />
          Bulk Import YouTube Links
          </button>
        </div>

        {showBulkImport && (
          <div className="card library-view__bulk-card">
            <div className="library-view__bulk-head">
              <div>
                <h2>Bulk import links</h2>
                <p>Paste one video per line. Titles are matched to exercises automatically.</p>
              </div>
              <button className="btn btn-secondary btn-small library-view__bulk-close" onClick={handleBulkClose} aria-label="Close bulk import">
                <X size={16} />
              </button>
            </div>
            <textarea
              className="input"
              rows={6}
              placeholder={`https://youtube.com/watch?v=...\nhttps://youtu.be/...\n\nOr use: Exercise Name | URL`}
              value={bulkText}
              onChange={(e) => { setBulkText(e.target.value); setBulkRows(null); setBulkSaved(false); }}
            />
            <div className="library-view__bulk-actions">
              {!bulkRows && (
                <button
                  className="btn btn-secondary btn-small library-view__bulk-match"
                  onClick={handleBulkPreview}
                  disabled={!bulkText.trim() || bulkLoading}
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
                <span className="library-view__bulk-saved">
                  <Check size={14} /> Saved {bulkSaved.saved} link{bulkSaved.saved !== 1 ? 's' : ''}
                  {bulkSaved.skipped > 0 && (
                    <span>
                      - {bulkSaved.skipped} unmatched skipped
                    </span>
                  )}
                </span>
              )}
            </div>

            {bulkRows && (() => {
              const exerciseCounts = {};
              bulkRows.forEach((r, i) => {
                if (r.matchedExercise) {
                  if (!exerciseCounts[r.matchedExercise]) exerciseCounts[r.matchedExercise] = [];
                  exerciseCounts[r.matchedExercise].push(i);
                }
              });

              return (
              <div className="library-view__bulk-results">
                {bulkRows.map((r, i) => {
                  const isDuplicate = r.matchedExercise && exerciseCounts[r.matchedExercise]?.length > 1;
                  const hasExisting = r.matchedExercise && preImportLinks && preImportLinks[r.matchedExercise];
                  const hasWarning = isDuplicate || hasExisting;
                  const resultClass = hasWarning ? 'library-view__bulk-result--warning' : r.matchedExercise ? 'library-view__bulk-result--matched' : 'library-view__bulk-result--warning';

                  return (
                  <div
                    key={i}
                    className={`library-view__bulk-result ${resultClass}`}
                  >
                    <div className="library-view__bulk-result-title">
                      {hasWarning ? (
                        <AlertTriangle size={12} />
                      ) : r.matchedExercise ? (
                        <Check size={12} />
                      ) : (
                        <AlertTriangle size={12} />
                      )}
                      <span>
                        {r.videoTitle || 'Could not fetch title'}
                      </span>
                    </div>
                    {isDuplicate && (
                      <div className="library-view__bulk-warning">
                        Duplicate - multiple videos matched to "{r.matchedExercise}". Only the last one will be saved.
                      </div>
                    )}
                    {hasExisting && !isDuplicate && (
                      <div className="library-view__bulk-warning">
                        Will overwrite existing:{' '}
                        <span>
                          {preImportLinks[r.matchedExercise]}
                        </span>
                      </div>
                    )}
                    <div className="library-view__bulk-match-row">
                      <span>Match</span>
                      <select
                        className="input"
                        value={r.matchedExercise || ''}
                        onChange={(e) => handleBulkMatchChange(i, e.target.value)}
                      >
                        <option value="">- Select exercise -</option>
                        {exerciseNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="library-view__bulk-url">
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
      </div>
        </>
      )}
    </div>
  );
}
