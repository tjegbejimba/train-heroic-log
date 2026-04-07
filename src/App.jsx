import { useState, useEffect, useCallback } from 'react';
import { useWorkouts } from './hooks/useWorkouts';
import { useSchedule } from './hooks/useSchedule';
import { useYouTubeLinks } from './hooks/useYouTubeLinks';
import { useWorkoutLogs } from './hooks/useWorkoutLogs';
import { useActiveWorkout } from './hooks/useActiveWorkout';
import { useTemplates } from './hooks/useTemplates';
import { useSync } from './hooks/useSync';
import { flushPendingPushes, retryFailedPushes } from './storage/sync';
import { removeLS, clearLS } from './storage/index';
import { useToast } from './components/Toast';
import { applyTemplateChange, applyScheduleChange, applyNoteChange, applyImport } from './orchestrator';
import {
  ROUTE_IMPORT,
  ROUTE_TRAINING,
  ROUTE_ACTIVE_WORKOUT,
  ROUTE_HISTORY,
  ROUTE_LIBRARY,
  ROUTE_PLANNER,
  ROUTE_SETTINGS,
  ROUTE_EDIT_TEMPLATE,
  ROUTE_EXERCISE_HISTORY,
  ROUTE_STATS,
  ROUTE_TEMPLATES,
  parseLogKey,
} from './constants';

import ImportView from './views/ImportView';
import TrainingView from './views/TrainingView';
import ActiveWorkoutView from './views/ActiveWorkoutView';
import HistoryView from './views/HistoryView';
import LibraryView from './views/LibraryView';
import WeekPlannerView from './views/WeekPlannerView';
import SettingsView from './views/SettingsView';
import TemplateEditorView from './views/TemplateEditorView';
import TemplateListView from './views/TemplateListView';
import ExerciseHistoryView from './views/ExerciseHistoryView';
import StatsView from './views/StatsView';
import Modal from './components/Modal';
import NavBar from './components/NavBar';
import ErrorBoundary from './components/ErrorBoundary';
import FeedbackModal from './components/FeedbackModal';
import { MessageSquare } from 'lucide-react';

import './styles/App.css';

// Module-level guard: once set, prevents new state writes from being
// enqueued between flushPendingPushes() completing and the reload firing.
let syncReloadInProgress = false;

async function safeFlushAndReload(sessionStorageEntries = {}) {
  if (syncReloadInProgress) return;
  syncReloadInProgress = true;
  window.stop(); // abort pending async operations to prevent new writes
  Object.entries(sessionStorageEntries).forEach(([k, v]) => sessionStorage.setItem(k, v));
  await flushPendingPushes();
  setTimeout(() => window.location.reload(), 0);
}

export default function App() {
  // Data hooks
  const { workouts, saveWorkouts } = useWorkouts();
  const { schedule, saveSchedule, getWorkoutForDate } = useSchedule();
  const { links, setLink, setManyLinks, getLink } = useYouTubeLinks();
  const { logs, saveLog, getLog, deleteLog, completedDates, allLogs } = useWorkoutLogs();
  const { session, createSession, updateSession, clearSession } = useActiveWorkout();
  const {
    templates,
    templateList,
    saveTemplates,
    duplicateTemplate,
  } = useTemplates();
  const { syncStatus, lastSynced, pullSync, pushSync, clearServer } = useSync();
  const showToast = useToast();

  // Orchestration: snapshot builder + write dispatcher
  const snap = () => ({ templates, workouts, schedule, logs });
  const applyWrites = (result) => {
    if (result.error) { showToast(result.error, 'error'); return false; }
    if (result.templates !== undefined) saveTemplates(result.templates);
    if (result.workouts !== undefined) saveWorkouts(result.workouts);
    if (result.schedule !== undefined) saveSchedule(result.schedule);
    return true;
  };

  const handleDeleteTemplate = (id) =>
    applyWrites(applyTemplateChange(snap(), { type: 'delete', templateId: id }));

  // Navigation state — after a sync-triggered reload, always land on Training
  const [navState, setNavState] = useState(() => {
    const syncReload = sessionStorage.getItem('syncReload');
    if (syncReload) {
      sessionStorage.removeItem('syncReload');
      return { view: ROUTE_TRAINING, params: {} };
    }
    return {
      view: Object.keys(workouts).length === 0 ? ROUTE_IMPORT : ROUTE_TRAINING,
      params: {},
    };
  });

  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // On startup, pull from server and reload if new data arrived
  useEffect(() => {
    const skipSync = sessionStorage.getItem('skipSync');
    if (skipSync) {
      sessionStorage.removeItem('skipSync');
      return;
    }
    pullSync().then(async ({ ok, changed }) => {
      if (changed) {
        await safeFlushAndReload({ syncReload: '1' });
      } else if (ok) {
        retryFailedPushes(); // push any previously-failed keys
      }
    });
  }, []);

  // Show toast when server overwrites local data during sync
  useEffect(() => {
    const keyLabels = {
      th_workouts: 'Workouts',
      th_schedule: 'Schedule',
      th_logs: 'Logs',
      th_templates: 'Templates',
      th_yt_links: 'YouTube Links',
      th_active: 'Active Session',
    };
    const handler = (e) => {
      const keys = e.detail?.keys;
      if (!Array.isArray(keys) || keys.length === 0) return;
      const labels = keys.map((k) => keyLabels[k] || k);
      showToast(`Server updated: ${labels.join(', ')}`, 'info');
    };
    window.addEventListener('sync-merge-conflict', handler);
    return () => window.removeEventListener('sync-merge-conflict', handler);
  }, [showToast]);

  // Check for crash recovery on mount
  useEffect(() => {
    if (session && Object.keys(workouts).length > 0) {
      try {
        const { date, workoutTitle } = parseLogKey(session.logKey);

        // Discard sessions older than 7 days
        const sessionDate = new Date(date + 'T00:00:00');
        const diffDays = (Date.now() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
        if (isNaN(diffDays) || diffDays > 7) {
          clearSession();
          return;
        }

        // Don't offer resume if the log is already completed
        const existingLog = getLog(session.logKey);
        if (existingLog && existingLog.completedAt) {
          clearSession();
          return;
        }

        const w = workouts[workoutTitle];
        const isValid =
          w &&
          Array.isArray(w.blocks) &&
          w.blocks.length > 0 &&
          w.blocks.some((b) => Array.isArray(b.exercises) && b.exercises.length > 0);
        if (isValid) {
          setShowResumeModal(true);
        } else {
          // Workout was deleted or is malformed — discard the orphaned session
          clearSession();
        }
      } catch {
        // logKey is unparseable — discard
        clearSession();
      }
    }
  }, []);

  useEffect(() => {
    history.replaceState({ view: navState.view, params: navState.params }, '');
  }, []);

  useEffect(() => {
    const handlePopState = (e) => {
      if (e.state && e.state.view) {
        const targetView = e.state.view === ROUTE_ACTIVE_WORKOUT ? ROUTE_TRAINING : e.state.view;
        setNavState({ view: targetView, params: e.state.params || {} });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigation function
  const navigate = useCallback((view, params = {}) => {
    setNavState({ view, params });
    history.pushState({ view, params }, '');
  }, []);

  // Handle resume modal
  const handleResumeYes = () => {
    setShowResumeModal(false);
    if (session) {
      navigate(ROUTE_ACTIVE_WORKOUT, { logKey: session.logKey });
    }
  };

  const handleResumeNo = () => {
    setShowResumeModal(false);
    clearSession();
  };

  // When applying a template to the schedule, ensure the workout exists
  const handleSetWorkoutDate = (dateStr, workoutTitle) =>
    applyWrites(applyScheduleChange(snap(), { [dateStr]: workoutTitle ?? null }));

  const handleApplyPlan = (dateMap) =>
    applyWrites(applyScheduleChange(snap(), dateMap));

  // Wrapped rename handler that also updates schedule and workouts (Bug 2 + Bug 4)
  const handleRenameTemplate = (id, newName) => {
    const tpl = templates[id];
    if (!tpl) return;
    applyWrites(applyTemplateChange(snap(), { type: 'save', template: { ...tpl, name: newName }, previousName: tpl.name }));
  };

  // Render current view
  let currentView = null;
  const { view, params } = navState;

  switch (view) {
    case ROUTE_IMPORT:
      currentView = (
        <ImportView
          onImport={(workoutMap, scheduleMap) => {
            applyWrites(applyImport(snap(), workoutMap, scheduleMap));
            navigate(ROUTE_TRAINING);
            const count = Object.keys(workoutMap).length;
            showToast(`Imported ${count} workout${count !== 1 ? 's' : ''} as templates!`);
          }}
        />
      );
      break;

    case ROUTE_TRAINING:
      currentView = (
        <TrainingView
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          workouts={workouts}
          schedule={schedule}
          completedDates={completedDates}
          getWorkoutForDate={getWorkoutForDate}
          getLog={getLog}
          onStartWorkout={(logKey) => {
            createSession(logKey, new Date().toISOString());
            navigate(ROUTE_ACTIVE_WORKOUT, { logKey });
          }}
          onScheduleTemplate={(date, templateName) => {
            applyWrites(applyScheduleChange(snap(), { [date]: templateName }));
          }}
          templateList={templateList}
          navigate={navigate}
        />
      );
      break;

    case ROUTE_ACTIVE_WORKOUT: {
      const { workoutTitle: activeWorkoutTitle } = parseLogKey(params.logKey);
      currentView = (
        <ActiveWorkoutView
          logKey={params.logKey}
          workouts={workouts}
          logs={logs}
          allLogs={allLogs}
          saveLog={saveLog}
          getYouTubeLink={getLink}
          onComplete={() => {
            clearSession();
            navigate(ROUTE_TRAINING);
            showToast('Workout completed!');
          }}
          onCancel={() => {
            clearSession();
            navigate(ROUTE_TRAINING);
          }}
          onUpdateWorkout={(updatedBlocks) =>
            applyWrites(applyTemplateChange(snap(), { type: 'syncBlocks', workoutTitle: activeWorkoutTitle, blocks: updatedBlocks }))
          }
        />
      );
      break;
    }

    case ROUTE_HISTORY:
      currentView = (
        <HistoryView
          allLogs={allLogs}
          deleteLog={deleteLog}
          workouts={workouts}
          completedDates={completedDates}
        />
      );
      break;

    case ROUTE_STATS:
      currentView = (
        <StatsView
          logs={logs}
          completedDates={completedDates}
        />
      );
      break;

    case ROUTE_LIBRARY:
      currentView = (
        <LibraryView
          workouts={workouts}
          youtubeLinks={links}
          setYouTubeLink={setLink}
          setManyYouTubeLinks={setManyLinks}
          onExerciseTap={(exerciseTitle) => navigate(ROUTE_EXERCISE_HISTORY, { exerciseTitle })}
          onUpdateExerciseNotes={(exerciseTitle, notes) =>
            applyWrites(applyNoteChange(snap(), exerciseTitle, notes))
          }
        />
      );
      break;

    case ROUTE_PLANNER:
      currentView = (
        <WeekPlannerView
          schedule={schedule}
          onApplyPlan={handleApplyPlan}
          showToast={showToast}
          templateList={templateList}
          templates={templates}
          workouts={workouts}
          onNavigateToDate={(dateStr) => {
            setCurrentDate(dateStr);
            navigate(ROUTE_TRAINING);
          }}
        />
      );
      break;

    case ROUTE_SETTINGS:
      currentView = (
        <SettingsView
          onReimport={() => {
            navigate(ROUTE_IMPORT);
          }}
          templateList={templateList}
          deleteTemplate={handleDeleteTemplate}
          renameTemplate={handleRenameTemplate}
          duplicateTemplate={duplicateTemplate}
          navigate={navigate}
          onClearAllData={async (keys) => {
            if (syncReloadInProgress) return;
            syncReloadInProgress = true;
            window.stop();
            await flushPendingPushes(); // flush any in-flight writes before clearing
            if (!keys) {
              // Clear server first — if offline the server keeps old data, which
              // would win on next pull and restore everything the user just deleted.
              await clearServer();
              clearLS();
            } else {
              keys.forEach((k) => removeLS(k));
            }
            sessionStorage.setItem('skipSync', '1');
            setTimeout(() => window.location.reload(), 0);
          }}
          syncStatus={syncStatus}
          lastSynced={lastSynced}
          onPullSync={async () => {
            const { ok, changed } = await pullSync();
            if (ok) {
              showToast(changed ? 'Synced from server!' : 'Already up to date');
              if (changed) {
                await safeFlushAndReload({ syncReload: '1' });
              }
            } else {
              showToast('Server unreachable', 'error');
            }
          }}
          onPushSync={async () => {
            const ok = await pushSync();
            showToast(ok ? 'Pushed to server!' : 'Server unreachable', ok ? 'success' : 'error');
          }}
        />
      );
      break;

    case ROUTE_TEMPLATES:
      currentView = (
        <TemplateListView
          templateList={templateList}
          deleteTemplate={handleDeleteTemplate}
          navigate={navigate}
        />
      );
      break;

    case ROUTE_EDIT_TEMPLATE: {
      const tpl = templates[params.templateId];
      // Build exercise names list from all workouts
      const exerciseNameSet = new Set();
      Object.values(workouts).forEach((w) =>
        w.blocks.forEach((b) =>
          b.exercises.forEach((ex) => exerciseNameSet.add(ex.title))
        )
      );
      const exerciseNames = [...exerciseNameSet].sort((a, b) => a.localeCompare(b));

      currentView = tpl ? (
        <TemplateEditorView
          template={tpl}
          exerciseNames={exerciseNames}
          onSave={(updated) => {
            const ok = applyWrites(applyTemplateChange(snap(), {
              type: 'save',
              template: updated,
              previousName: tpl.name,
            }));
            if (ok) {
              navigate(ROUTE_TEMPLATES);
              showToast('Template saved!');
            }
          }}
          onCancel={() => navigate(ROUTE_TEMPLATES)}
        />
      ) : (
        <SettingsView
          onReimport={() => navigate(ROUTE_IMPORT)}
          templateList={templateList}
          deleteTemplate={handleDeleteTemplate}
          renameTemplate={handleRenameTemplate}
          duplicateTemplate={duplicateTemplate}
          navigate={navigate}
          onClearAllData={async (keys) => {
            if (syncReloadInProgress) return;
            syncReloadInProgress = true;
            window.stop();
            await flushPendingPushes(); // flush any in-flight writes before clearing
            if (!keys) {
              // Clear server first — if offline the server keeps old data, which
              // would win on next pull and restore everything the user just deleted.
              await clearServer();
              clearLS();
            } else {
              keys.forEach((k) => removeLS(k));
            }
            sessionStorage.setItem('skipSync', '1');
            setTimeout(() => window.location.reload(), 0);
          }}
          syncStatus={syncStatus}
          lastSynced={lastSynced}
          onPullSync={async () => {
            const { ok, changed } = await pullSync();
            if (ok) {
              showToast(changed ? 'Synced from server!' : 'Already up to date');
              if (changed) {
                await safeFlushAndReload({ syncReload: '1' });
              }
            } else {
              showToast('Server unreachable', 'error');
            }
          }}
          onPushSync={async () => {
            const ok = await pushSync();
            showToast(ok ? 'Pushed to server!' : 'Server unreachable', ok ? 'success' : 'error');
          }}
        />
      );
      break;
    }

    case ROUTE_EXERCISE_HISTORY:
      currentView = (
        <ExerciseHistoryView
          exerciseTitle={params.exerciseTitle}
          allLogs={allLogs}
          navigate={navigate}
        />
      );
      break;

    default:
      navigate(ROUTE_TRAINING);
      currentView = null;
      break;
  }

  return (
    <div className="app">
      <ErrorBoundary key={view}>
        {currentView}
      </ErrorBoundary>

      {view !== ROUTE_ACTIVE_WORKOUT && view !== ROUTE_EDIT_TEMPLATE && view !== ROUTE_EXERCISE_HISTORY && (
        <NavBar
          currentTab={view}
          onTabChange={(tab) => navigate(tab)}
          syncStatus={syncStatus}
        />
      )}

      {view !== ROUTE_ACTIVE_WORKOUT && (
        <button
          className="feedback-fab"
          onClick={() => setShowFeedback(true)}
          aria-label="Send feedback"
        >
          <MessageSquare size={15} />
        </button>
      )}

      {showFeedback && (
        <FeedbackModal
          onClose={() => setShowFeedback(false)}
          showToast={showToast}
          currentView={view}
        />
      )}

      {showResumeModal && (() => {
        let workoutName = 'Unknown Workout';
        let dateLabel = '';
        let progressLabel = '';
        let durationLabel = '';

        try {
          const { date, workoutTitle } = parseLogKey(session.logKey);
          workoutName = workoutTitle || 'Unknown Workout';

          // Format date nicely (e.g. "Sat, Apr 4")
          if (date) {
            const d = new Date(date + 'T00:00:00');
            if (!isNaN(d.getTime())) {
              dateLabel = d.toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              });
            }
          }

          // Count completed sets from saved log (session only stores crash recovery metadata)
          let completedSets = 0;
          const existingLog = getLog(session.logKey);
          if (existingLog?.exercises && typeof existingLog.exercises === 'object') {
            for (const sets of Object.values(existingLog.exercises)) {
              if (Array.isArray(sets)) {
                completedSets += sets.filter((s) => s.completed).length;
              }
            }
          }

          // Count total sets from workout definition
          const w = workouts[workoutTitle];
          let totalSets = 0;
          if (w && Array.isArray(w.blocks)) {
            for (const block of w.blocks) {
              if (Array.isArray(block.exercises)) {
                for (const ex of block.exercises) {
                  totalSets += Array.isArray(ex.sets) ? ex.sets.length : 0;
                }
              }
            }
          }

          if (totalSets > 0) {
            progressLabel = `${completedSets} of ${totalSets} sets completed`;
          } else if (completedSets > 0) {
            progressLabel = `${completedSets} sets completed`;
          } else {
            progressLabel = 'No sets logged yet';
          }

          // Duration since session started
          if (session.startedAt) {
            const elapsed = Date.now() - new Date(session.startedAt).getTime();
            if (elapsed > 0) {
              const mins = Math.floor(elapsed / 60000);
              if (mins < 60) {
                durationLabel = `Started ${mins} min ago`;
              } else {
                const hrs = Math.floor(mins / 60);
                durationLabel = hrs === 1 ? 'Started 1 hour ago' : `Started ${hrs} hours ago`;
              }
            }
          }
        } catch {
          // logKey unparseable — show defaults
        }

        return (
          <Modal
            title="Resume Workout?"
            onConfirm={handleResumeYes}
            onCancel={handleResumeNo}
            confirmText="Resume"
            cancelText="Discard"
          >
            <div style={{ marginBottom: '1rem', fontSize: '0.95rem', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{workoutName}</div>
              {dateLabel && <div style={{ color: '#aaa' }}>{dateLabel}</div>}
              <div style={{ marginTop: '0.5rem' }}>{progressLabel}</div>
              {durationLabel && <div style={{ color: '#aaa', marginTop: '0.25rem' }}>{durationLabel}</div>}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
