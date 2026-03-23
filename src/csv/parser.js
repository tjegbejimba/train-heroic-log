/**
 * Parse TrainHeroic CSV exports into structured workout data
 */
import { parseExerciseData } from './exerciseData';

/**
 * Parse CSV text into structured data
 * @param {string} csvText - Raw CSV text
 * @returns {Object} { workoutMap, scheduleMap, parseErrors }
 */
export function parseCSV(csvText) {
  try {
    const rows = parseCSVRows(csvText);
    if (rows.length === 0) {
      return { workoutMap: {}, scheduleMap: {}, parseErrors: ['No data found in CSV'] };
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Validate required columns
    const requiredCols = [
      'WorkoutTitle',
      'ExerciseTitle',
      'ExerciseData',
    ];
    const missingCols = requiredCols.filter((col) => !headers.includes(col));
    if (missingCols.length > 0) {
      return {
        workoutMap: {},
        scheduleMap: {},
        parseErrors: [`Missing required columns: ${missingCols.join(', ')}`],
      };
    }

    // Build data structures
    const workoutMap = {};
    const scheduleMap = {};
    const parseErrors = [];

    // Group rows by workout
    const workoutGroups = {};
    dataRows.forEach((row) => {
      const rowObj = {};
      headers.forEach((header, i) => {
        rowObj[header] = (row[i] || '').trim();
      });

      const workoutTitle = rowObj.WorkoutTitle || 'Untitled';
      if (!workoutGroups[workoutTitle]) {
        workoutGroups[workoutTitle] = [];
      }
      workoutGroups[workoutTitle].push(rowObj);
    });

    // Process each workout
    Object.entries(workoutGroups).forEach(([workoutTitle, rows]) => {
      const blocks = {};
      const blockOrder = [];

      rows.forEach((row) => {
        const blockKey = `${row.BlockValue || ''}::${row.BlockUnits || ''}`;
        if (!blocks[blockKey]) {
          blocks[blockKey] = {
            value: row.BlockValue || '',
            units: row.BlockUnits || '',
            instructions: row.BlockInstructions || '',
            notes: row.BlockNotes || '',
            exercises: {},
          };
          blockOrder.push(blockKey);
        }

        const exerciseTitle = row.ExerciseTitle || 'Untitled';
        if (!blocks[blockKey].exercises[exerciseTitle]) {
          blocks[blockKey].exercises[exerciseTitle] = [];
        }
        blocks[blockKey].exercises[exerciseTitle].push(row);
      });

      // Convert blocks object to array and parse exercises
      const blockArray = blockOrder.map((blockKey) => {
        const block = blocks[blockKey];
        const exercises = Object.entries(block.exercises).map(([exerciseTitle, rows]) => {
          const sets = resolveExerciseSets(rows);
          return {
            title: exerciseTitle,
            notes: rows[0].ExerciseNotes || '',
            sets,
          };
        });
        return { ...block, exercises };
      });

      workoutMap[workoutTitle] = {
        title: workoutTitle,
        notes: rows[0].WorkoutNotes || '',
        blocks: blockArray,
      };

      // Build schedule from first row (prefer RescheduledDate)
      const firstRow = rows[0];
      const date = normalizeDate(firstRow.RescheduledDate || firstRow.ScheduledDate);
      if (date && date !== 'invalid-date') {
        scheduleMap[date] = workoutTitle;
      }
    });

    return { workoutMap, scheduleMap, parseErrors };
  } catch (e) {
    console.error('CSV parse error:', e);
    return {
      workoutMap: {},
      scheduleMap: {},
      parseErrors: [`Parse error: ${e.message}`],
    };
  }
}

/**
 * Parse CSV rows accounting for quoted fields and multi-line cells
 * @param {string} csvText - Raw CSV text
 * @returns {Array<Array<string>>} Array of rows, each row is array of cells
 */
function parseCSVRows(csvText) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentCell += '"';
        i++;
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // End of cell
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      // End of row
      if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell);
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      }
      // Skip \r\n as a pair
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    } else {
      currentCell += char;
    }
  }

  // Flush remaining
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Determine sets for an exercise based on whether data is multi-row or single-row
 * @param {Array} rows - Array of row objects for a single exercise
 * @returns {Array} Array of {reps, weight, unit, ...}
 */
function resolveExerciseSets(rows) {
  if (rows.length === 0) return [];

  // Collect all parsed sets from all rows
  const allSets = [];
  rows.forEach((row) => {
    const sets = parseExerciseData(row.ExerciseData);
    allSets.push(...sets);
  });

  return allSets.length > 0 ? allSets : [{ reps: null, weight: null, unit: 'bw', rawReps: '', rawWeight: '' }];
}

/**
 * Normalize date to YYYY-MM-DD format
 * @param {string} dateStr - Date string in various formats
 * @returns {string} Normalized date YYYY-MM-DD or 'invalid-date'
 */
export function normalizeDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return 'invalid-date';

  dateStr = dateStr.trim();
  if (dateStr.length === 0) return 'invalid-date';

  // Try M/D/YYYY or MM/DD/YYYY
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Try YYYY-MM-DD
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return dateStr;
  }

  // Try parsing as Date object
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return 'invalid-date';
}

/**
 * Get summary stats from parsed data
 * @param {Object} workoutMap - Parsed workout map
 * @param {Object} scheduleMap - Parsed schedule map
 * @returns {Object} Summary stats
 */
export function getParseStats(workoutMap, scheduleMap) {
  const workoutCount = Object.keys(workoutMap).length;
  const exerciseCount = Object.values(workoutMap).reduce((sum, w) => {
    return sum + w.blocks.reduce((blockSum, b) => blockSum + b.exercises.length, 0);
  }, 0);
  const scheduledDates = Object.keys(scheduleMap).length;
  const dateRange =
    scheduledDates > 0
      ? {
          min: Object.keys(scheduleMap).sort()[0],
          max: Object.keys(scheduleMap).sort().reverse()[0],
        }
      : null;

  return {
    workoutCount,
    exerciseCount,
    scheduledDates,
    dateRange,
  };
}
