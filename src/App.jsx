import { useState, useEffect, useCallback } from 'react';
import { useWorkouts } from './hooks/useWorkouts';
import { useSchedule } from './hooks/useSchedule';
import { useYouTubeLinks } from './hooks/useYouTubeLinks';
import { useWorkoutLogs } from './hooks/useWorkoutLogs';
import { useActiveWorkout } from './hooks/useActiveWorkout';
import { useTemplates } from './hooks/useTemplates';
import { useSync } from './hooks/useSync';
import { useToast } from './components/Toast';
import {
  ROUTE_IMPORT,
  ROUTE_TRAINING,
  ROUTE_ACTIVE_WORKOUT,
  ROUTE_HISTORY,
  ROUTE_LIBRARY,
  ROUTE_PLANNER,
  ROUTE_SETTINGS,
  ROUTE_EDIT_TEMPLATE,
} from './constants';

import ImportView from './views/ImportView';
import TrainingView from './views/TrainingView';
import ActiveWorkoutView from './views/ActiveWorkoutView';
import HistoryView from './views/HistoryView';
import LibraryView from './views/LibraryView';
import WeekPlannerView from './views/WeekPlannerView';
import SettingsView from './views/SettingsView';
import TemplateEditorView from './views/TemplateEditorView';
import Modal from './components/Modal';
import NavBar from './components/NavBar';

import './styles/App.css';

export default function App() {
  // Data hooks
  const { workouts, saveWorkouts, updateExerciseNotes } = useWorkouts();
  const { schedule, saveSchedule, getWorkoutForDate, setWorkoutDate } = useSchedule();
  const { links, setLink, setManyLinks, getLink } = useYouTubeLinks();
  const { logs, saveLog, getLog, deleteLog, completedDates, allLogs } = useWorkoutLogs();
  const { session, createSession, updateSession, clearSession } = useActiveWorkout();
  const {
    templates,
    templateList,
    saveTemplates,
    saveTemplate,
    deleteTemplate,
    renameTemplate,
    duplicateTemplate,
    createTemplateFromWorkout,
  } = useTemplates();
  const { syncStatus, lastSynced, pullSync, pushSync, clearServer } = useSync();
  const showToast = useToast();

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
    return today.toISOString().split('T')[0];
  });

  const [showResumeModal, setShowResumeModal] = useState(false);

  // On startup, pull from server and reload if new data arrived
  useEffect(() => {
    const skipSync = sessionStorage.getItem('skipSync');
    if (skipSync) {
      sessionStorage.removeItem('skipSync');
      return;
    }
    pullSync().then(({ changed }) => {
      if (changed) {
        sessionStorage.setItem('syncReload', '1');
        window.location.reload();
      }
    });
  }, []);

  // Check for crash recovery on mount
  useEffect(() => {
    if (session && Object.keys(workouts).length > 0) {
      setShowResumeModal(true);
    }
  }, []);

  // Navigation function
  const navigate = useCallback((view, params = {}) => {
    setNavState({ view, params });
    // TODO: Update browser history
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
  const handleSetWorkoutDate = (dateStr, workoutTitle) => {
    if (workoutTitle) {
      // Create workout from template if it doesn't exist yet
      if (!workouts[workoutTitle]) {
        const tpl = templateList.find((t) => t.name === workoutTitle);
        if (tpl) {
          saveWorkouts({
            ...workouts,
            [workoutTitle]: { title: workoutTitle, blocks: tpl.blocks, notes: tpl.notes || '' },
          });
        }
      }
    } else {
      // Clearing a date — remove orphaned workout if no other date still uses it
      const evictedTitle = schedule[dateStr];
      if (evictedTitle) {
        const stillUsed = Object.entries(schedule).some(
          ([d, t]) => d !== dateStr && t === evictedTitle
        );
        if (!stillUsed && workouts[evictedTitle]) {
          const updated = { ...workouts };
          delete updated[evictedTitle];
          saveWorkouts(updated);
        }
      }
    }
    setWorkoutDate(dateStr, workoutTitle);
  };

  // Render current view
  let currentView = null;
  const { view, params } = navState;

  switch (view) {
    case ROUTE_IMPORT:
      currentView = (
        <ImportView
          onImport={(workoutMap, scheduleMap) => {
            saveWorkouts(workoutMap);
            saveSchedule(scheduleMap);
            // Auto-create a template for each workout title (skip duplicates by name)
            const existingByName = {};
            Object.entries(templates).forEach(([id, tpl]) => {
              existingByName[tpl.name] = id;
            });

            const updatedTemplates = { ...templates };
            Object.values(workoutMap).forEach((workout, i) => {
              const existingId = existingByName[workout.title];
              if (existingId) {
                // Update existing template with fresh data
                updatedTemplates[existingId] = {
                  ...updatedTemplates[existingId],
                  blocks: workout.blocks,
                  notes: workout.notes || updatedTemplates[existingId].notes || '',
                };
              } else {
                const id = `tpl_${Date.now()}_${i}`;
                updatedTemplates[id] = {
                  id,
                  name: workout.title,
                  createdDate: new Date().toISOString(),
                  blocks: workout.blocks,
                  notes: workout.notes || '',
                };
              }
            });
            saveTemplates(updatedTemplates);
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
          setWorkoutDate={setWorkoutDate}
          getYouTubeLink={getLink}
          setYouTubeLink={setLink}
          onUpdateExerciseNotes={(workoutTitle, exerciseTitle, notes) => {
            updateExerciseNotes(workoutTitle, exerciseTitle, notes);
            // Keep matching template in sync
            const tpl = templateList.find((t) => t.name === workoutTitle);
            if (tpl) {
              const updatedBlocks = tpl.blocks.map((block) => ({
                ...block,
                exercises: block.exercises.map((ex) =>
                  ex.title === exerciseTitle ? { ...ex, notes } : ex
                ),
              }));
              saveTemplate(tpl.id, { ...tpl, blocks: updatedBlocks });
            }
          }}
          onStartWorkout={(logKey) => {
            createSession(logKey, new Date().toISOString());
            navigate(ROUTE_ACTIVE_WORKOUT, { logKey });
          }}
          onSaveAsTemplate={(workout) => {
            const exists = templateList.some(
              (t) => t.name.toLowerCase() === workout.title.toLowerCase()
            );
            if (exists) {
              showToast('A template with this name already exists', 'error');
              return false;
            }
            createTemplateFromWorkout(workout);
            showToast('Template saved!');
          }}
          navigate={navigate}
        />
      );
      break;

    case ROUTE_ACTIVE_WORKOUT:
      currentView = (
        <ActiveWorkoutView
          logKey={params.logKey}
          workouts={workouts}
          logs={logs}
          saveLog={saveLog}
          getYouTubeLink={getLink}
          updateSession={updateSession}
          clearSession={clearSession}
          onComplete={() => {
            clearSession();
            navigate(ROUTE_TRAINING);
            showToast('Workout completed!');
          }}
          onCancel={() => {
            clearSession();
            navigate(ROUTE_TRAINING);
          }}
        />
      );
      break;

    case ROUTE_HISTORY:
      currentView = (
        <HistoryView
          allLogs={allLogs}
          deleteLog={deleteLog}
          workouts={workouts}
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
          onUpdateExerciseNotes={(exerciseTitle, notes) => {
            // Update across all workouts that use this exercise
            const updatedWorkouts = {};
            Object.entries(workouts).forEach(([title, workout]) => {
              const updatedBlocks = workout.blocks.map((block) => ({
                ...block,
                exercises: block.exercises.map((ex) =>
                  ex.title === exerciseTitle ? { ...ex, notes } : ex
                ),
              }));
              updatedWorkouts[title] = { ...workout, blocks: updatedBlocks };
            });
            saveWorkouts(updatedWorkouts);

            // Update across all templates that use this exercise
            const updatedTemplates = {};
            Object.entries(templates).forEach(([id, tpl]) => {
              const updatedBlocks = tpl.blocks.map((block) => ({
                ...block,
                exercises: block.exercises.map((ex) =>
                  ex.title === exerciseTitle ? { ...ex, notes } : ex
                ),
              }));
              updatedTemplates[id] = { ...tpl, blocks: updatedBlocks };
            });
            saveTemplates(updatedTemplates);
          }}
        />
      );
      break;

    case ROUTE_PLANNER:
      currentView = (
        <WeekPlannerView
          schedule={schedule}
          setWorkoutDate={handleSetWorkoutDate}
          showToast={showToast}
          templateList={templateList}
          templates={templates}
          workouts={workouts}
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
          deleteTemplate={deleteTemplate}
          renameTemplate={renameTemplate}
          duplicateTemplate={duplicateTemplate}
          navigate={navigate}
          onClearAllData={async (keys) => {
            if (!keys) {
              localStorage.clear();
              await clearServer();
            } else {
              keys.forEach((k) => localStorage.removeItem(k));
              await pushSync();
            }
            sessionStorage.setItem('skipSync', '1');
            window.location.reload();
          }}
          syncStatus={syncStatus}
          lastSynced={lastSynced}
          onPullSync={async () => {
            const { ok, changed } = await pullSync();
            if (ok) {
              showToast(changed ? 'Synced from server!' : 'Already up to date');
              if (changed) {
                sessionStorage.setItem('syncReload', '1');
                window.location.reload();
              }
            } else {
              showToast('Server unreachable');
            }
          }}
          onPushSync={async () => {
            const ok = await pushSync();
            showToast(ok ? 'Pushed to server!' : 'Server unreachable');
          }}
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
            saveTemplate(updated.id, updated);
            // Also update matching workout if it exists
            if (workouts[tpl.name]) {
              const updatedWorkouts = { ...workouts };
              // If name changed, remove old key and add new
              if (tpl.name !== updated.name) {
                delete updatedWorkouts[tpl.name];
              }
              updatedWorkouts[updated.name] = {
                title: updated.name,
                blocks: updated.blocks,
                notes: updated.notes || '',
              };
              saveWorkouts(updatedWorkouts);
            }
            navigate(ROUTE_SETTINGS);
            showToast('Template saved!');
          }}
          onCancel={() => navigate(ROUTE_SETTINGS)}
        />
      ) : (
        <SettingsView
          onReimport={() => navigate(ROUTE_IMPORT)}
          templateList={templateList}
          deleteTemplate={deleteTemplate}
          renameTemplate={renameTemplate}
          duplicateTemplate={duplicateTemplate}
          navigate={navigate}
          onClearAllData={async (keys) => {
            if (!keys) {
              localStorage.clear();
              await clearServer();
            } else {
              keys.forEach((k) => localStorage.removeItem(k));
              await pushSync();
            }
            sessionStorage.setItem('skipSync', '1');
            window.location.reload();
          }}
          syncStatus={syncStatus}
          lastSynced={lastSynced}
          onPullSync={async () => {
            const { ok, changed } = await pullSync();
            if (ok) {
              showToast(changed ? 'Synced from server!' : 'Already up to date');
              if (changed) {
                sessionStorage.setItem('syncReload', '1');
                window.location.reload();
              }
            } else {
              showToast('Server unreachable');
            }
          }}
          onPushSync={async () => {
            const ok = await pushSync();
            showToast(ok ? 'Pushed to server!' : 'Server unreachable');
          }}
        />
      );
      break;
    }

    default:
      currentView = <TrainingView />;
  }

  return (
    <div className="app">
      {currentView}

      {view !== ROUTE_ACTIVE_WORKOUT && view !== ROUTE_EDIT_TEMPLATE && (
        <NavBar
          currentTab={view}
          onTabChange={(tab) => navigate(tab)}
        />
      )}

      {showResumeModal && (
        <Modal
          title="Resume Workout?"
          message="You have an active workout session. Would you like to resume?"
          onConfirm={handleResumeYes}
          onCancel={handleResumeNo}
          confirmText="Resume"
          cancelText="Discard"
        />
      )}
    </div>
  );
}
