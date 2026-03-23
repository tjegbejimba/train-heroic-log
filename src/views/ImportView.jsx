import { useRef, useState } from 'react';
import { parseCSV, getParseStats } from '../csv/parser';

export default function ImportView({ onImport }) {
  const fileInputRef = useRef(null);
  const [parseStats, setParseStats] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [isReady, setIsReady] = useState(false);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result;
        const { workoutMap, scheduleMap, parseErrors: errors } = parseCSV(csvText);

        if (errors.length > 0) {
          setParseErrors(errors);
          setParseStats(null);
          setIsReady(false);
          return;
        }

        const stats = getParseStats(workoutMap, scheduleMap);
        setParseStats({
          workoutMap,
          scheduleMap,
          stats,
        });
        setParseErrors([]);
        setIsReady(true);
      } catch (err) {
        setParseErrors([`Error parsing CSV: ${err.message}`]);
        setParseStats(null);
        setIsReady(false);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (parseStats && isReady) {
      onImport(parseStats.workoutMap, parseStats.scheduleMap);
    }
  };

  return (
    <div className="view view--full-height import-view">
      <div className="import-view__content">
        <div className="import-view__header">
          <h1>TrainLog</h1>
          <p className="text-secondary">Import your TrainHeroic workout data</p>
        </div>

        {!parseStats ? (
          <div className="import-view__upload">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              className="btn btn-primary btn--large"
              onClick={() => fileInputRef.current?.click()}
            >
              📁 Choose CSV File
            </button>
            <p className="text-secondary text-center mt-lg">
              Select your TrainHeroic CSV export
            </p>
          </div>
        ) : (
          <div className="import-view__preview card">
            <h2>Import Summary</h2>
            <div className="import-view__stats">
              <div className="stat">
                <div className="stat-label">Workouts</div>
                <div className="stat-value">{parseStats.stats.workoutCount}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Exercises</div>
                <div className="stat-value">{parseStats.stats.exerciseCount}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Scheduled Dates</div>
                <div className="stat-value">{parseStats.stats.scheduledDates}</div>
              </div>
            </div>
            {parseStats.stats.dateRange && (
              <p className="text-secondary text-center mt-lg">
                {parseStats.stats.dateRange.min} → {parseStats.stats.dateRange.max}
              </p>
            )}
            <div className="flex gap-md mt-lg">
              <button className="btn btn-secondary" onClick={() => setParseStats(null)}>
                Change File
              </button>
              <button className="btn btn-primary flex-1" onClick={handleImport}>
                Import Data
              </button>
            </div>
          </div>
        )}

        {parseErrors.length > 0 && (
          <div className="import-view__errors card">
            <h3>Errors</h3>
            <ul className="text-red">
              {parseErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
