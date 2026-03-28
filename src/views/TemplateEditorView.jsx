import { useState, useMemo, useRef } from 'react';
import { ChevronUp, ChevronDown, Plus, Trash2, X } from 'lucide-react';

const UNIT_OPTIONS = ['lb', 'kg', 'bw', 'reps', '%', 'yd', 'm', 'RPE', 'in', 'ft', 'sec'];

function makeEmptySet(unit = 'lb', repsUnit = 'reps') {
  return { reps: null, weight: null, unit, repsUnit, rawReps: '', rawWeight: '' };
}

function makeEmptyExercise() {
  return { title: '', notes: '', workoutNotes: '', sets: [makeEmptySet()], repsUnit: 'reps', showValue: true, unit: 'lb' };
}

function makeEmptyBlock() {
  return { value: '', units: '', instructions: '', notes: '', exercises: [makeEmptyExercise()] };
}

export default function TemplateEditorView({ template, exerciseNames, onSave, onCancel }) {
  const [name, setName] = useState(template.name);
  const [blocks, setBlocks] = useState(() =>
    template.blocks.length > 0 ? template.blocks.map(cloneBlock) : [makeEmptyBlock()]
  );

  // Exercise search state for picker
  // Refs mirror state so onBlur timeouts always read the current value (avoids stale closures)
  const [activeSearch, setActiveSearchState] = useState(null); // { blockIdx, exIdx }
  const activeSearchRef = useRef(null);
  const [searchQuery, setSearchQueryState] = useState('');
  const searchQueryRef = useRef('');

  function setActiveSearch(val) {
    activeSearchRef.current = val;
    setActiveSearchState(val);
  }

  function setSearchQuery(val) {
    searchQueryRef.current = val;
    setSearchQueryState(val);
  }

  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return exerciseNames;
    const q = searchQuery.toLowerCase();
    return exerciseNames.filter((n) => n.toLowerCase().includes(q));
  }, [exerciseNames, searchQuery]);

  // --- Block operations ---
  function addBlock() {
    setBlocks([...blocks, makeEmptyBlock()]);
  }

  function removeBlock(bIdx) {
    if (blocks.length <= 1) return;
    setBlocks(blocks.filter((_, i) => i !== bIdx));
  }

  function moveBlock(bIdx, dir) {
    const target = bIdx + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[bIdx], next[target]] = [next[target], next[bIdx]];
    setBlocks(next);
  }

  // --- Exercise operations ---
  function addExercise(bIdx) {
    const next = [...blocks];
    next[bIdx] = { ...next[bIdx], exercises: [...next[bIdx].exercises, makeEmptyExercise()] };
    setBlocks(next);
  }

  function removeExercise(bIdx, eIdx) {
    const next = [...blocks];
    const exs = next[bIdx].exercises.filter((_, i) => i !== eIdx);
    if (exs.length === 0) {
      // Remove the block if no exercises left
      removeBlock(bIdx);
      return;
    }
    next[bIdx] = { ...next[bIdx], exercises: exs };
    setBlocks(next);
  }

  function setExerciseTitle(bIdx, eIdx, title) {
    const next = [...blocks];
    next[bIdx] = {
      ...next[bIdx],
      exercises: next[bIdx].exercises.map((ex, i) =>
        i === eIdx ? { ...ex, title } : ex
      ),
    };
    setBlocks(next);
    setActiveSearch(null);
    setSearchQuery('');
  }

  function setExerciseNotes(bIdx, eIdx, workoutNotes) {
    const next = [...blocks];
    next[bIdx] = {
      ...next[bIdx],
      exercises: next[bIdx].exercises.map((ex, i) =>
        i === eIdx ? { ...ex, workoutNotes } : ex
      ),
    };
    setBlocks(next);
  }

  // --- Set operations ---
  function updateSet(bIdx, eIdx, sIdx, field, value) {
    const next = [...blocks];
    next[bIdx] = {
      ...next[bIdx],
      exercises: next[bIdx].exercises.map((ex, i) => {
        if (i !== eIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, j) => {
            if (j !== sIdx) return s;
            if (field === 'reps' || field === 'weight') {
              const num = value === '' ? null : parseFloat(value);
              return { ...s, [field]: isNaN(num) ? null : num };
            }
            return { ...s, [field]: value };
          }),
        };
      }),
    };
    setBlocks(next);
  }

  function updateExerciseUnit(bIdx, eIdx, unit) {
    const next = [...blocks];
    next[bIdx] = {
      ...next[bIdx],
      exercises: next[bIdx].exercises.map((ex, i) => {
        if (i !== eIdx) return ex;
        return { ...ex, unit, sets: ex.sets.map((s) => ({ ...s, unit })) };
      }),
    };
    setBlocks(next);
  }

  function updateRepsUnit(bIdx, eIdx, repsUnit) {
    const next = [...blocks];
    next[bIdx] = {
      ...next[bIdx],
      exercises: next[bIdx].exercises.map((ex, i) => {
        if (i !== eIdx) return ex;
        return { ...ex, repsUnit, sets: ex.sets.map((s) => ({ ...s, repsUnit })) };
      }),
    };
    setBlocks(next);
  }

  function toggleShowValue(bIdx, eIdx) {
    const next = [...blocks];
    next[bIdx] = {
      ...next[bIdx],
      exercises: next[bIdx].exercises.map((ex, i) => {
        if (i !== eIdx) return ex;
        const showValue = !(ex.showValue !== false);
        return {
          ...ex,
          showValue,
          sets: showValue ? ex.sets : ex.sets.map((s) => ({ ...s, weight: null })),
        };
      }),
    };
    setBlocks(next);
  }

  function addSet(bIdx, eIdx) {
    const next = [...blocks];
    next[bIdx] = {
      ...next[bIdx],
      exercises: next[bIdx].exercises.map((ex, i) => {
        if (i !== eIdx) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        const newSet = lastSet
          ? { ...lastSet, rawReps: '', rawWeight: '' }
          : makeEmptySet(ex.unit || 'lb');
        return { ...ex, sets: [...ex.sets, newSet] };
      }),
    };
    setBlocks(next);
  }

  function removeSet(bIdx, eIdx, sIdx) {
    const next = [...blocks];
    next[bIdx] = {
      ...next[bIdx],
      exercises: next[bIdx].exercises.map((ex, i) => {
        if (i !== eIdx) return ex;
        const sets = ex.sets.filter((_, j) => j !== sIdx);
        return { ...ex, sets: sets.length > 0 ? sets : [makeEmptySet()] };
      }),
    };
    setBlocks(next);
  }

  function handleSave() {
    // Filter out blocks with no exercises that have titles
    const cleanBlocks = blocks
      .map((block) => ({
        ...block,
        exercises: block.exercises.filter((ex) => ex.title.trim()),
      }))
      .filter((block) => block.exercises.length > 0);

    if (cleanBlocks.length === 0 || !name.trim()) return;

    onSave({
      ...template,
      name: name.trim(),
      blocks: cleanBlocks,
    });
  }

  const isPickerOpen = (bIdx, eIdx) =>
    activeSearch && activeSearch.blockIdx === bIdx && activeSearch.exIdx === eIdx;

  return (
    <div className="view tpl-editor">
      <div className="tpl-editor__header">
        <div className="tpl-editor__header-top">
          <button className="btn btn-secondary btn-small" onClick={onCancel}>
            <X size={14} /> Cancel
          </button>
          <button className="btn btn-primary btn-small" onClick={handleSave} disabled={!name.trim()}>
            Save Template
          </button>
        </div>
        <input
          type="text"
          className="input tpl-editor__name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name..."
        />
      </div>

      <div className="tpl-editor__blocks">
        {blocks.map((block, bIdx) => (
          <div key={bIdx} className="card tpl-editor__block">
            <div className="tpl-editor__block-header">
              <span className="tpl-editor__block-label">
                Part {String.fromCharCode(65 + bIdx)}
                {block.exercises.length > 1 && (
                  <span className="text-secondary text-sm"> (superset)</span>
                )}
              </span>
              <div className="tpl-editor__block-actions">
                <button
                  className="btn-icon"
                  onClick={() => moveBlock(bIdx, -1)}
                  disabled={bIdx === 0}
                  title="Move up"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  className="btn-icon"
                  onClick={() => moveBlock(bIdx, 1)}
                  disabled={bIdx === blocks.length - 1}
                  title="Move down"
                >
                  <ChevronDown size={16} />
                </button>
                <button
                  className="btn-icon btn-icon--danger"
                  onClick={() => removeBlock(bIdx)}
                  disabled={blocks.length <= 1}
                  title="Remove part"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {block.exercises.map((ex, eIdx) => (
              <div key={eIdx} className="tpl-editor__exercise">
                <div className="tpl-editor__exercise-header">
                  <div className="tpl-editor__exercise-picker" style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="Search exercises..."
                      value={isPickerOpen(bIdx, eIdx) ? searchQuery : ex.title}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (!isPickerOpen(bIdx, eIdx)) {
                          setActiveSearch({ blockIdx: bIdx, exIdx: eIdx });
                          setSearchQuery(e.target.value);
                        }
                      }}
                      onFocus={() => {
                        setActiveSearch({ blockIdx: bIdx, exIdx: eIdx });
                        setSearchQuery(ex.title);
                      }}
                      onBlur={() => {
                        // Delay to allow click on dropdown item.
                        // Read from refs (not closure) to get current values when the timeout fires.
                        setTimeout(() => {
                          const curActive = activeSearchRef.current;
                          if (curActive?.blockIdx === bIdx && curActive?.exIdx === eIdx) {
                            const curQuery = searchQueryRef.current;
                            if (curQuery.trim() && curQuery !== ex.title) {
                              setExerciseTitle(bIdx, eIdx, curQuery.trim());
                            }
                            setActiveSearch(null);
                            setSearchQuery('');
                          }
                        }, 200);
                      }}
                    />
                    {isPickerOpen(bIdx, eIdx) && filteredExercises.length > 0 && (
                      <div className="tpl-editor__dropdown">
                        {filteredExercises.slice(0, 15).map((name) => (
                          <button
                            key={name}
                            className="tpl-editor__dropdown-item"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setExerciseTitle(bIdx, eIdx, name);
                            }}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn-icon btn-icon--danger"
                    onClick={() => removeExercise(bIdx, eIdx)}
                    title="Remove exercise"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <textarea
                  className="input tpl-editor__exercise-notes"
                  placeholder="Workout-specific notes (e.g. paused reps, 8 each side, rest 2 min)"
                  value={ex.workoutNotes || ''}
                  onChange={(e) => setExerciseNotes(bIdx, eIdx, e.target.value)}
                  rows={2}
                />

                <div className={`tpl-editor__sets${ex.showValue === false ? ' tpl-editor__sets--no-value' : ''}`}>
                  <div className="tpl-editor__sets-header">
                    <span className="text-secondary text-sm">Set</span>
                    <select
                      className="input tpl-editor__set-unit"
                      value={ex.repsUnit || 'reps'}
                      onChange={(e) => updateRepsUnit(bIdx, eIdx, e.target.value)}
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                    <div className="tpl-editor__value-header">
                      {ex.showValue !== false ? (
                        <>
                          <select
                            className="input tpl-editor__set-unit"
                            value={ex.unit || ex.sets[0]?.unit || 'lb'}
                            onChange={(e) => updateExerciseUnit(bIdx, eIdx, e.target.value)}
                          >
                            {UNIT_OPTIONS.map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                          <button
                            className="btn-icon btn-icon--small"
                            onClick={() => toggleShowValue(bIdx, eIdx)}
                            title="Remove value column"
                          >
                            <X size={10} />
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={() => toggleShowValue(bIdx, eIdx)}
                          title="Add value column"
                        >
                          + val
                        </button>
                      )}
                    </div>
                    <span></span>
                  </div>
                  {ex.sets.map((set, sIdx) => (
                    <div key={sIdx} className="tpl-editor__set-row">
                      <span className="tpl-editor__set-num">{sIdx + 1}</span>
                      <input
                        type="number"
                        className="input tpl-editor__set-input"
                        placeholder="—"
                        value={set.reps ?? ''}
                        onChange={(e) => updateSet(bIdx, eIdx, sIdx, 'reps', e.target.value)}
                      />
                      {ex.showValue !== false ? (
                        <input
                          type="number"
                          className="input tpl-editor__set-input"
                          placeholder="—"
                          value={set.weight ?? ''}
                          onChange={(e) => updateSet(bIdx, eIdx, sIdx, 'weight', e.target.value)}
                        />
                      ) : (
                        <span />
                      )}
                      <button
                        className="btn-icon btn-icon--danger btn-icon--small"
                        onClick={() => removeSet(bIdx, eIdx, sIdx)}
                        title="Remove set"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    className="btn btn-secondary btn-small tpl-editor__add-set"
                    onClick={() => addSet(bIdx, eIdx)}
                  >
                    + Set
                  </button>
                </div>
              </div>
            ))}

            <button
              className="btn btn-secondary btn-small tpl-editor__add-exercise"
              onClick={() => addExercise(bIdx)}
            >
              <Plus size={12} /> Add Exercise to Part
            </button>
          </div>
        ))}
      </div>

      <div className="tpl-editor__footer">
        <button className="btn btn-secondary" onClick={addBlock}>
          <Plus size={14} /> Add Part
        </button>
      </div>
    </div>
  );
}

function cloneBlock(block) {
  return {
    ...block,
    exercises: block.exercises.map((ex) => ({
      ...ex,
      repsUnit: ex.repsUnit || ex.repsLabel || 'reps',
      showValue: ex.showValue !== false,
      unit: ex.unit || ex.sets[0]?.unit || 'lb',
      sets: ex.sets.map((s) => ({ ...s, repsUnit: s.repsUnit || s.repsLabel || 'reps' })),
    })),
  };
}
