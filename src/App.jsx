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
} from './constants';

import ImportView from './views/ImportView';
import TrainingView from './views/TrainingView';
import ActiveWorkoutView from './views/ActiveWorkoutView';
import HistoryView from './views/HistoryView';
import LibraryView from './views/LibraryView';
import WeekPlannerView from './views/WeekPlannerView';
import SettingsView from './views/SettingsView';
import Modal from './components/Modal';
import NavBar from './components/NavBar';

import './styles/App.css';

export default function App() {
  // Data hooks
  const { workouts, saveWorkouts } = useWorkouts();
  const { schedule, saveSchedule, getWorkoutForDate, setWorkoutDate } = useSchedule();
  const { links, setLink, getLink } = useYouTubeLinks();
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
  const { syncStatus, lastSynced, pullSync, pushSync } = useSync();
  const showToast = useToast();

  // Navigation state
  const [navState, setNavState] = useState({
    view: Object.keys(workouts).length === 0 ? ROUTE_IMPORT : ROUTE_TRAINING,
    params: {},
  });

  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [showResumeModal, setShowResumeModal] = useState(false);

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
      // Check if workout exists, if not create from template
      if (!workouts[workoutTitle]) {
        const tpl = templateList.find((t) => t.name === workoutTitle);
        if (tpl) {
          const updatedWorkouts = {
            ...workouts,
            [workoutTitle]: {
              title: workoutTitle,
              blocks: tpl.blocks,
              notes: tpl.notes || '',
            },
          };
          saveWorkouts(updatedWorkouts);
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
            // Auto-create a template for each workout title
            const templateMap = {};
            Object.values(workoutMap).forEach((workout, i) => {
              const id = `tpl_${Date.now()}_${i}`;
              templateMap[id] = {
                id,
                name: workout.title,
                createdDate: new Date().toISOString(),
                blocks: workout.blocks,
                notes: workout.notes || '',
              };
            });
            saveTemplates({ ...templates, ...templateMap });
            navigate(ROUTE_TRAINING);
            const count = Object.keys(templateMap).length;
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
          onStartWorkout={(logKey) => {
            createSession(logKey, new Date().toISOString());
            navigate(ROUTE_ACTIVE_WORKOUT, { logKey });
          }}
          onSaveAsTemplate={(workout) => {
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
        />
      );
      break;

    case ROUTE_PLANNER:
      currentView = (
        <WeekPlannerView
          schedule={schedule}
          setWorkoutDate={handleSetWorkoutDate}
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
          onClearAllData={() => {
            localStorage.clear();
            window.location.reload();
          }}
          syncStatus={syncStatus}
          lastSynced={lastSynced}
          onPullSync={async () => {
            const ok = await pullSync();
            if (ok) {
              showToast('Synced from server!');
              window.location.reload();
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

    default:
      currentView = <TrainingView />;
  }

  return (
    <div className="app">
      {currentView}

      {view !== ROUTE_ACTIVE_WORKOUT && (
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
