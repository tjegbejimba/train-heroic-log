import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  FileUp,
  GitMerge,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { parseCSV, getParseStats } from '../csv/parser';
import Modal from '../components/Modal';

function exerciseSummary(definition) {
  const exercises = (definition.blocks || []).flatMap((block) => block.exercises || []);
  return exercises.map((exercise) => ({
    title: exercise.title,
    notes: exercise.notes || '',
    sets: exercise.sets || [],
  }));
}

function setTarget(set) {
  const reps = set.reps ?? set.rawReps ?? '—';
  const weight = set.weight ?? set.rawWeight;
  const unit = set.unit || '';
  if (String(weight).toLowerCase() === 'bw' || unit === 'bw') {
    return `${reps} reps @ bodyweight`;
  }
  return weight === null || weight === undefined || weight === ''
    ? `${reps} reps`
    : `${reps} reps @ ${weight} ${unit}`.trim();
}

function definitionChanges(conflict) {
  const existing = new Map(
    exerciseSummary(conflict.existingTemplate).map((exercise) => [exercise.title, exercise])
  );
  const imported = new Map(
    exerciseSummary(conflict.importedWorkout).map((exercise) => [exercise.title, exercise])
  );
  const added = [...imported.keys()].filter((title) => !existing.has(title));
  const removed = [...existing.keys()].filter((title) => !imported.has(title));
  const changed = [...imported.keys()].filter((title) =>
    existing.has(title) &&
    JSON.stringify(existing.get(title)) !== JSON.stringify(imported.get(title))
  );
  return { added, removed, changed };
}

function ResultList({ title, items, emptyText }) {
  return (
    <section className="import-report__section">
      <h2>{title} <span>{items.length}</span></h2>
      {items.length ? (
        <ul className="import-report__list">
          {items.map((item, index) => (
            <li key={`${item.name}-${index}`}>
              <strong>{item.name}</strong>
              <span>
                {item.resolution || `${item.dates.length} scheduled date${item.dates.length === 1 ? '' : 's'}`}
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="import-report__empty">{emptyText}</p>}
    </section>
  );
}

function DefinitionPanel({ label, definition }) {
  return (
    <div>
      <h4>{label}</h4>
      {definition.notes && <p className="import-conflict__workout-note">{definition.notes}</p>}
      {(definition.blocks || []).map((block, blockIndex) => (
        <section className="import-conflict__block" key={`${block.value || 'part'}-${blockIndex}`}>
          {(block.value || block.units) && (
            <h5>{[block.value, block.units].filter(Boolean).join(' · ')}</h5>
          )}
          {block.instructions && <p>{block.instructions}</p>}
          {block.notes && <p>{block.notes}</p>}
          <ul>
            {(block.exercises || []).map((exercise) => (
              <li key={exercise.title}>
                <div>
                  <span>{exercise.title}</span>
                  {exercise.notes && <small>{exercise.notes}</small>}
                  {exercise.workoutNotes && <small>{exercise.workoutNotes}</small>}
                </div>
                <small>
                  {(exercise.sets || []).length
                    ? exercise.sets.map(setTarget).join(' · ')
                    : 'No prescribed sets'}
                  {exercise.restDuration ? ` · Rest ${exercise.restDuration}s` : ''}
                  {exercise.barWeight ? ` · Bar ${exercise.barWeight}` : ''}
                </small>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TemplateConflict({
  conflict,
  renameValue,
  onRenameChange,
  onResolve,
}) {
  const changes = definitionChanges(conflict);
  const changeLabels = [
    changes.added.length && `${changes.added.length} added`,
    changes.removed.length && `${changes.removed.length} removed`,
    changes.changed.length && `${changes.changed.length} prescription changed`,
  ].filter(Boolean);

  return (
    <article className="import-conflict">
      <div className="import-conflict__head">
        <div>
          <h3>{conflict.existingName}</h3>
          <p>{changeLabels.join(' · ') || 'Notes or prescribed sets differ'}</p>
        </div>
        <span className="import-conflict__badge">Needs choice</span>
      </div>

      <details className="import-conflict__details">
        <summary>Compare workout definitions</summary>
        <div className="import-conflict__compare">
          {[
            ['Current', conflict.existingTemplate],
            ['Imported', conflict.importedWorkout],
          ].map(([label, definition]) => (
            <DefinitionPanel key={label} label={label} definition={definition} />
          ))}
        </div>
      </details>

      <div className="import-conflict__actions">
        <button className="btn btn-secondary" onClick={() => onResolve('keep')}>
          Keep current
        </button>
        <button className="btn btn-secondary" onClick={() => onResolve('replace')}>
          Use imported
        </button>
      </div>
      <div className="import-conflict__rename">
        <label htmlFor={`rename-${conflict.id}`}>Import a separate copy</label>
        <div>
          <input
            id={`rename-${conflict.id}`}
            value={renameValue}
            onChange={(event) => onRenameChange(event.target.value)}
          />
          <button className="btn btn-primary" onClick={() => onResolve('rename')}>
            Import with new name
          </button>
        </div>
      </div>
    </article>
  );
}

function ImportReport({ report, onResolveConflict, onUpdateReport, onDone }) {
  const [renameValues, setRenameValues] = useState(() =>
    Object.fromEntries(report.templateConflicts.map((conflict) => [
      conflict.id,
      conflict.suggestedName,
    ]))
  );
  const conflictCount = report.templateConflicts.length + report.scheduleConflicts.length;

  const resolve = (currentReport, resolution) => {
    const nextReport = onResolveConflict(currentReport, resolution);
    return nextReport || currentReport;
  };

  const resolveOne = (resolution) => {
    const nextReport = resolve(report, resolution);
    if (nextReport !== report) {
      onUpdateReport(nextReport);
    }
  };

  const resolveAll = (kind, action) => {
    let nextReport = report;
    const conflicts = kind === 'template'
      ? [...nextReport.templateConflicts]
      : [...nextReport.scheduleConflicts];
    conflicts.forEach((conflict) => {
      nextReport = resolve(nextReport, { kind, id: conflict.id, action });
    });
    onUpdateReport(nextReport);
  };

  const finish = () => {
    let nextReport = report;
    [...nextReport.templateConflicts].forEach((conflict) => {
      nextReport = resolve(nextReport, {
        kind: 'template',
        id: conflict.id,
        action: 'keep',
      });
    });
    [...nextReport.scheduleConflicts].forEach((conflict) => {
      nextReport = resolve(nextReport, {
        kind: 'schedule',
        id: conflict.id,
        action: 'keep',
      });
    });
    onDone();
  };

  return (
    <div className="import-report">
      <div className="import-view__header">
        <span className="import-view__icon" aria-hidden="true"><GitMerge size={28} /></span>
        <h1>Import report</h1>
        <p>Safe items are already added. Review anything that matched existing data.</p>
      </div>

      <div className="import-report__summary" aria-label="Import summary">
        {[
          ['Imported', report.imported.length],
          ['Already present', report.alreadyPresent.length],
          ['Template conflicts', report.templateConflicts.length],
          ['Schedule conflicts', report.scheduleConflicts.length],
        ].map(([label, count]) => (
          <div key={label}>
            <span>{count}</span>
            <small>{label}</small>
          </div>
        ))}
      </div>

      <ResultList title="Imported" items={report.imported} emptyText="No new templates were added." />
      <ResultList
        title="Already present"
        items={report.alreadyPresent}
        emptyText="No exact matches were found."
      />

      <section className="import-report__section">
        <div className="import-report__section-head">
          <h2>Template conflicts <span>{report.templateConflicts.length}</span></h2>
          {report.templateConflicts.length > 1 && (
            <div>
              <button className="btn btn-ghost" onClick={() => resolveAll('template', 'keep')}>
                Keep all current
              </button>
              <button className="btn btn-ghost" onClick={() => resolveAll('template', 'replace')}>
                Use all imported
              </button>
            </div>
          )}
        </div>
        {report.templateConflicts.map((conflict) => (
          <TemplateConflict
            key={conflict.id}
            conflict={conflict}
            renameValue={renameValues[conflict.id] || conflict.suggestedName}
            onRenameChange={(value) => setRenameValues((current) => ({
              ...current,
              [conflict.id]: value,
            }))}
            onResolve={(action) => resolveOne({
              kind: 'template',
              id: conflict.id,
              action,
              newName: renameValues[conflict.id] || conflict.suggestedName,
            })}
          />
        ))}
        {!report.templateConflicts.length && (
          <p className="import-report__empty">No unresolved template conflicts.</p>
        )}
      </section>

      <section className="import-report__section">
        <div className="import-report__section-head">
          <h2>Schedule conflicts <span>{report.scheduleConflicts.length}</span></h2>
          {report.scheduleConflicts.length > 1 && (
            <div>
              <button className="btn btn-ghost" onClick={() => resolveAll('schedule', 'keep')}>
                Keep all scheduled
              </button>
              <button className="btn btn-ghost" onClick={() => resolveAll('schedule', 'replace')}>
                Use all imported
              </button>
            </div>
          )}
        </div>
        {report.scheduleConflicts.map((conflict) => (
          <article className="import-conflict import-conflict--schedule" key={conflict.id}>
            <div>
              <h3>{conflict.date}</h3>
              <p>
                Keep <strong>{conflict.existingTitle}</strong> or schedule{' '}
                <strong>{conflict.importedTitle}</strong>
                {conflict.completed ? ' (a completed workout exists on this date)' : ''}.
              </p>
            </div>
            <div className="import-conflict__actions">
              <button className="btn btn-secondary" onClick={() => resolveOne({
                kind: 'schedule',
                id: conflict.id,
                action: 'keep',
              })}>
                Keep scheduled
              </button>
              <button className="btn btn-primary" onClick={() => resolveOne({
                kind: 'schedule',
                id: conflict.id,
                action: 'replace',
              })}>
                Use imported
              </button>
            </div>
          </article>
        ))}
        {!report.scheduleConflicts.length && (
          <p className="import-report__empty">No unresolved schedule conflicts.</p>
        )}
      </section>

      {!conflictCount && (
        <div className="import-report__resolved">
          <CheckCircle2 size={20} />
          <strong>All conflicts resolved</strong>
        </div>
      )}
      <button className="btn btn-primary btn--large w-full" onClick={finish}>
        {conflictCount ? 'Keep unresolved items and finish' : 'Done'}
      </button>
    </div>
  );
}

export default function ImportView({
  onMergeImport,
  onResolveConflict,
  onReplaceImport,
  onDone,
  existingCounts = { workouts: 0, scheduledDates: 0 },
}) {
  const fileInputRef = useRef(null);
  const [parseStats, setParseStats] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [report, setReport] = useState(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const viewRef = useRef(null);
  const hasShownReportRef = useRef(false);

  useEffect(() => {
    if (report && !hasShownReportRef.current) {
      viewRef.current?.scrollTo?.({ top: 0 });
      hasShownReportRef.current = true;
    }
  }, [report]);

  const parseCsvText = (text) => {
    if (!text || !text.trim()) {
      setParseErrors(['Paste CSV text or choose a TrainHeroic export file first.']);
      setParseStats(null);
      setIsReady(false);
      return;
    }

    try {
      const { workoutMap, scheduleMap, parseErrors: errors } = parseCSV(text);
      if (errors.length > 0) {
        setParseErrors(errors);
        setParseStats(null);
        setIsReady(false);
        return;
      }
      setParseStats({
        workoutMap,
        scheduleMap,
        stats: getParseStats(workoutMap, scheduleMap),
      });
      setParseErrors([]);
      setIsReady(true);
    } catch (err) {
      setParseErrors([`Error parsing CSV: ${err.message}`]);
      setParseStats(null);
      setIsReady(false);
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const nextText = String(event.target?.result || '');
      setCsvText(nextText);
      parseCsvText(nextText);
    };
    reader.readAsText(file);
  };

  const handleMerge = () => {
    if (!parseStats || !isReady) return;
    setReport(onMergeImport(parseStats.workoutMap, parseStats.scheduleMap));
  };

  if (report) {
    return (
      <div ref={viewRef} className="view view--full-height import-view">
        <div className="import-view__content">
          <ImportReport
            report={report}
            onResolveConflict={onResolveConflict}
            onUpdateReport={setReport}
            onDone={onDone}
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={viewRef} className="view view--full-height import-view">
      <div className="import-view__content">
        <div className="import-view__header">
          <span className="import-view__icon" aria-hidden="true"><FileUp size={28} /></span>
          <h1>Import TrainHeroic CSV</h1>
          <p>Add a partial or complete export without losing workouts already in TrainLog.</p>
        </div>

        {!parseStats ? (
          <div
            className={`import-view__upload${isDragging ? ' import-view__upload--dragging' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              handleFile(event.dataTransfer.files?.[0]);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(event) => handleFile(event.target.files?.[0])}
              className="import-view__file-input"
            />
            <span className="import-view__drop-icon" aria-hidden="true"><FileUp size={30} /></span>
            <button className="btn btn-primary btn--large" onClick={() => fileInputRef.current?.click()}>
              Choose CSV File
            </button>
            <p>Drag a .csv file here, or choose from Files.</p>
            <div className="import-view__paste">
              <label htmlFor="csv-paste"><ClipboardPaste size={15} />Paste CSV</label>
              <textarea
                id="csv-paste"
                value={csvText}
                onChange={(event) => {
                  setCsvText(event.target.value);
                  if (parseErrors.length) setParseErrors([]);
                }}
                placeholder="WorkoutTitle,ScheduledDate,ExerciseTitle,ExerciseData..."
                rows={5}
              />
              <button
                className="btn btn-secondary"
                onClick={() => parseCsvText(csvText)}
                disabled={!csvText.trim()}
              >
                Preview pasted CSV
              </button>
            </div>
          </div>
        ) : (
          <div className="import-view__preview card">
            <div className="import-view__preview-head">
              <span aria-hidden="true"><ShieldCheck size={22} /></span>
              <div>
                <h2>Ready to import</h2>
                <p>Merge safely is recommended for partial and complete exports.</p>
              </div>
            </div>
            <div className="import-view__stats">
              {[
                ['Workouts', parseStats.stats.workoutCount],
                ['Exercises', parseStats.stats.exerciseCount],
                ['Scheduled Dates', parseStats.stats.scheduledDates],
              ].map(([label, value]) => (
                <div className="import-stat" key={label}>
                  <div className="stat-label">{label}</div>
                  <div className="stat-value">{value}</div>
                </div>
              ))}
            </div>
            {parseStats.stats.dateRange && (
              <p className="import-view__date-range">
                {parseStats.stats.dateRange.min} to {parseStats.stats.dateRange.max}
              </p>
            )}
            <div className="import-view__safe-callout">
              <ShieldCheck size={18} />
              <div>
                <strong>Keeps everything already in TrainLog</strong>
                <span>New workouts and dates are added; matches are sent to a review report.</span>
              </div>
            </div>
            <div className="import-view__actions import-view__actions--stacked">
              <button className="btn btn-primary btn--large" onClick={handleMerge}>
                <GitMerge size={17} /> Merge safely
              </button>
              <button className="btn btn-secondary" onClick={() => setParseStats(null)}>
                <RefreshCw size={15} /> Change File
              </button>
              <button className="btn btn-ghost import-view__replace" onClick={() => setShowReplaceConfirm(true)}>
                Replace all workouts and schedule
              </button>
            </div>
          </div>
        )}

        {parseErrors.length > 0 && (
          <div className="import-view__errors card">
            <div className="import-view__errors-head">
              <span aria-hidden="true"><AlertTriangle size={18} /></span>
              <h3>CSV needs attention</h3>
            </div>
            <ul>{parseErrors.map((error) => <li key={error}>{error}</li>)}</ul>
          </div>
        )}
      </div>

      {showReplaceConfirm && (
        <Modal
          title="Replace all workout data?"
          message={`This replaces ${existingCounts.workouts} workouts and ${existingCounts.scheduledDates} scheduled dates. Only continue with a complete export. Completed workout history is preserved.`}
          confirmText="Replace all"
          isDestructive
          onCancel={() => setShowReplaceConfirm(false)}
          onConfirm={() => {
            onReplaceImport(parseStats.workoutMap, parseStats.scheduleMap);
            setShowReplaceConfirm(false);
          }}
        />
      )}
    </div>
  );
}
