export default function ActiveWorkoutView({
  logKey,
  workouts,
  logs,
  saveLog,
  getYouTubeLink,
  updateSession,
  clearSession,
  onComplete,
  onCancel,
}) {
  return (
    <div className="view active-workout-view">
      <div className="active-workout-view__header">
        <button onClick={onCancel} className="btn btn-secondary">
          ← Cancel
        </button>
        <h2>Active Workout</h2>
      </div>
      <div className="empty-state">
        <p>Active Workout View - Coming Soon</p>
      </div>
    </div>
  );
}
