import { useId, useState } from 'react';
import { GitCompareArrows, ChevronDown } from 'lucide-react';
import { formatSet } from '../utils/formatters';

const LABELS = { th_schedule: 'Schedule', th_templates: 'Template', th_workouts: 'Workout', th_logs: 'Session log', th_active: 'Active session', th_yt_links: 'Video link' };

function ProposalValue({ proposal }) {
  if (!proposal.present) return <p>Removed</p>;
  const value = proposal.value;
  if (value == null) return <p>Cleared</p>;
  if (typeof value !== 'object') return <p className="sync-conflicts__value">{String(value)}</p>;
  const blocks = Array.isArray(value.blocks) ? value.blocks : Array.isArray(value) ? value : [];
  const exercises = blocks.flatMap((part) => part && typeof part === 'object'
    ? Array.isArray(part.exercises) ? part.exercises : part.title ? [part] : [] : []);
  return (
    <>
      {(value.name || value.title) && <p className="sync-conflicts__value">{value.name || value.title}</p>}
      {exercises.map((exercise, index) => (
        <div className="sync-conflicts__exercise" key={`${exercise.title}-${index}`}>
          <strong>{exercise.title}</strong>
          <p>{(Array.isArray(exercise.sets) ? exercise.sets : []).map((set) => formatSet(set)).join('; ')}</p>
          {exercise.workoutNotes && <p>{exercise.workoutNotes}</p>}
          {exercise.notes && <p>Form notes: {exercise.notes}</p>}
        </div>
      ))}
      <details className="sync-conflicts__raw">
        <summary>Full proposal</summary>
        <pre>{JSON.stringify(value, null, 2)}</pre>
      </details>
    </>
  );
}

export default function SyncConflicts({ conflicts, error, resolving, onResolve, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const regionId = useId();
  if (!conflicts.length) return null;
  const conflict = conflicts[0];
  return (
    <section className="sync-conflicts" aria-label="Sync conflicts">
      <button className="sync-conflicts__toggle" aria-expanded={expanded} aria-controls={regionId} onClick={() => setExpanded(!expanded)}>
        <GitCompareArrows size={20} aria-hidden="true" />
        <span>Review sync conflicts ({conflicts.length})</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {expanded && (
        <div id={regionId} className="sync-conflicts__body">
          <h2>{conflict.key === 'th_schedule' ? 'Choose the schedule to keep' : 'Choose the change to keep'}</h2>
          <p className="sync-conflicts__context">{LABELS[conflict.key] || conflict.key} · {conflict.path.join(' / ') || 'Whole section'}</p>
          <p>Both proposals are saved. The other choice stays recoverable after you decide.</p>
          {conflict.reason === 'baseline-unavailable' && <p>This device has no previous sync baseline. Review the complete section before choosing.</p>}
          <div className="sync-conflicts__comparison">
            <div>
              <h3>Your app edit</h3>
              <ProposalValue proposal={conflict.local} />
              <button className="btn btn-secondary" disabled={resolving} onClick={() => onResolve(conflict.id, 'local')}>{resolving ? 'Saving choice…' : 'Keep my edit'}</button>
            </div>
            <div>
              <h3>Server / coach change</h3>
              <ProposalValue proposal={conflict.remote} />
              <button className="btn btn-secondary" disabled={resolving} onClick={() => onResolve(conflict.id, 'remote')}>{resolving ? 'Saving choice…' : 'Keep server change'}</button>
            </div>
          </div>
          {error && <div className="sync-conflicts__error" role="alert"><p>{error}</p><button className="btn btn-secondary" disabled={resolving} onClick={onRefresh}>Refresh conflicts</button></div>}
        </div>
      )}
    </section>
  );
}
