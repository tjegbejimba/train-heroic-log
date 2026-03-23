import { useState, useEffect, useCallback } from 'react';
import { useWorkouts } from './hooks/useWorkouts';
import { useSchedule } from './hooks/useSchedule';
import { useYouTubeLinks } from './hooks/useYouTubeLinks';
import { useWorkoutLogs } from './hooks/useWorkoutLogs';
import { useActiveWorkout } from './hooks/useActiveWorkout';
import {
  ROUTE_IMPORT,
  ROUTE_TRAINING,
  ROUTE_ACTIVE_WORKOUT,
  ROUTE_HISTORY,
  ROUTE_LIBRARY,
  ROUTE_SETTINGS,
} from './constants';

import ImportView from './views/ImportView';
import TrainingView from './views/TrainingView';
import ActiveWorkoutView from './views/ActiveWorkoutView';
import HistoryView from './views/HistoryView';
import LibraryView from './views/LibraryView';
import SettingsView from './views/SettingsView';
import Modal from './components/Modal';
import NavBar from './components/NavBar';

import './styles/App.css';

export default function App() {
  // Data hooks
  const { workouts, saveWorkouts } = useWorkouts();
  const { schedule, saveSchedule, getWorkoutForDate, setWorkoutDate } = useSchedule();
  const { links, setLink, getLink } = useYouTubeLinks();
  const { logs, saveLog, getLog, completedDates } = useWorkoutLogs();
  const { session, createSession, updateSession, clearSession } = useActiveWorkout();

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
            navigate(ROUTE_TRAINING);
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
          logs={logs}
          workouts={workouts}
          getYouTubeLink={getLink}
          navigate={navigate}
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

    case ROUTE_SETTINGS:
      currentView = (
        <SettingsView
          onReimport={() => {
            navigate(ROUTE_IMPORT);
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
