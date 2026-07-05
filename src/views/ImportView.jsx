import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardPaste, FileUp, RefreshCw } from 'lucide-react';
import { parseCSV, getParseStats } from '../csv/parser';

export default function ImportView({ onImport }) {
  const fileInputRef = useRef(null);
  const [parseStats, setParseStats] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [isDragging, setIsDragging] = useState(false);

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

  const handleFileSelect = (e) => {
    handleFile(e.target.files?.[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
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
          <span className="import-view__icon" aria-hidden="true">
            <FileUp size={28} />
          </span>
          <h1>Import TrainHeroic CSV</h1>
          <p>Drop an export, choose a file, or paste raw CSV to build workouts, schedule, and templates.</p>
        </div>

        {!parseStats ? (
          <div
            className={`import-view__upload${isDragging ? ' import-view__upload--dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="import-view__file-input"
            />
            <span className="import-view__drop-icon" aria-hidden="true">
              <FileUp size={30} />
            </span>
            <button
              className="btn btn-primary btn--large"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose CSV File
            </button>
            <p>
              Drag a .csv file here, or choose from Files.
            </p>
            <div className="import-view__paste">
              <label htmlFor="csv-paste">
                <ClipboardPaste size={15} />
                Paste CSV
              </label>
              <textarea
                id="csv-paste"
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
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
              <span aria-hidden="true"><CheckCircle2 size={22} /></span>
              <div>
                <h2>Ready to import</h2>
                <p>Review the parsed program before replacing local workout data.</p>
              </div>
            </div>
            <div className="import-view__stats">
              <div className="import-stat">
                <div className="stat-label">Workouts</div>
                <div className="stat-value">{parseStats.stats.workoutCount}</div>
              </div>
              <div className="import-stat">
                <div className="stat-label">Exercises</div>
                <div className="stat-value">{parseStats.stats.exerciseCount}</div>
              </div>
              <div className="import-stat">
                <div className="stat-label">Scheduled Dates</div>
                <div className="stat-value">{parseStats.stats.scheduledDates}</div>
              </div>
            </div>
            {parseStats.stats.dateRange && (
              <p className="import-view__date-range">
                {parseStats.stats.dateRange.min} to {parseStats.stats.dateRange.max}
              </p>
            )}
            <div className="import-view__actions">
              <button className="btn btn-secondary" onClick={() => setParseStats(null)}>
                <RefreshCw size={15} />
                Change File
              </button>
              <button className="btn btn-primary" onClick={handleImport}>
                Import Data
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
            <ul>
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
