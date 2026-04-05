# Data Orchestration Layer — Interface Design

## Architecture: 3 Layers

```
┌─────────────────────────────────────────────────────────┐
│  Layer 3: React Context (DataProvider)                  │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ DataState   │  │ DataActions  │  │ SyncContext    │  │
│  │ Context     │  │ Context      │  │ (separate)     │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Layer 2: useDataStore() — single useReducer            │
│  • Owns ALL domain state in one object                  │
│  • commit(changes) → writeLS per key → dispatch         │
│  • Actions are stable refs (close over dispatch)        │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Pure operations (operations.js)               │
│  • (state, params) → { changes } | { error }           │
│  • Zero React, zero I/O — fully testable                │
│  • Orphan cleanup, validation, cascade logic            │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Interface Signatures

### Layer 1: `src/data/operations.js`

Every function takes a state snapshot + action params, returns a changeset or error.
Changeset shape: `{ templates?, workouts?, schedule? }` — only keys that changed,
each containing the **full new value** for that slice.

```js
// ── Shared helpers ──────────────────────────────────────

/**
 * @param {string} title - workout title to check
 * @param {Object} opts
 * @param {Object} opts.workouts  - current workouts map
 * @param {Object} opts.schedule  - current schedule map
 * @param {Object} opts.logs      - current logs map
 * @returns {boolean}
 */
export function isWorkoutOrphan(title, { workouts, schedule, logs })

/**
 * @param {string} name       - proposed name
 * @param {string|null} excludeId - template id to exclude (for rename)
 * @param {Object} templates  - current templates map
 * @returns {boolean}
 */
export function hasNameCollision(name, excludeId, templates)


// ── Orchestration operations ────────────────────────────

/**
 * Delete template → clean schedule → remove orphan workout.
 * @param {string} id
 * @param {{ templates, schedule, workouts, logs }} state
 * @returns {{ templates, schedule?, workouts? }}
 */
export function deleteTemplate(id, state)

/**
 * Assign or clear a workout date.
 * If assigning: creates workout from template when missing.
 * If clearing: removes orphaned workout.
 * @param {string} dateStr
 * @param {string|null} workoutTitle - null to clear
 * @param {{ templates, schedule, workouts, logs }} state
 * @returns {{ schedule, workouts? }}
 */
export function setWorkoutDate(dateStr, workoutTitle, state)

/**
 * Batch-apply a week plan. Single-pass schedule + workout update.
 * @param {Object<string, string|null>} dateMap - date → title|null
 * @param {{ templates, schedule, workouts, logs }} state
 * @returns {{ schedule, workouts? }}
 */
export function applyPlan(dateMap, state)

/**
 * Rename template → update schedule refs → rename workout key.
 * @param {string} id
 * @param {string} newName
 * @param {{ templates, schedule, workouts }} state
 * @returns {{ templates, schedule?, workouts? } | { error: string }}
 */
export function renameTemplate(id, newName, state)

/**
 * Import CSV data. Merges into templates preserving workoutNotes.
 * @param {Object} workoutMap  - imported workouts
 * @param {Object} scheduleMap - imported schedule
 * @param {{ templates, workouts, schedule }} state
 * @returns {{ templates, workouts, schedule }}
 */
export function importWorkouts(workoutMap, scheduleMap, state)

/**
 * Save template edits → cascade to workout + schedule if renamed.
 * @param {{ id, name }} original - original template (pre-edit)
 * @param {Object} updated        - full updated template object
 * @param {{ templates, workouts, schedule }} state
 * @returns {{ templates, workouts?, schedule? } | { error: string }}
 */
export function saveTemplateEdit(original, updated, state)

/**
 * Update exercise.notes across ALL workouts and ALL templates.
 * (Library view — global note change)
 * @param {string} exerciseTitle
 * @param {string} notes
 * @param {{ workouts, templates }} state
 * @returns {{ workouts, templates }}
 */
export function updateExerciseNotesGlobal(exerciseTitle, notes, state)

/**
 * Update exercise.notes in one workout + its matching template.
 * (Training view — single-workout note change)
 * @param {string} workoutTitle
 * @param {string} exerciseTitle
 * @param {string} notes
 * @param {{ workouts, templates }} state
 * @returns {{ workouts, templates? }}
 */
export function updateExerciseNotesInWorkout(workoutTitle, exerciseTitle, notes, state)

/**
 * Validate + prepare template creation from active workout.
 * @param {Object} workout - { title, blocks }
 * @param {{ templates }} state
 * @returns {{ valid: true } | { error: string }}
 */
export function validateSaveAsTemplate(workout, state)
```

### Layer 2: `src/data/useDataStore.js`

Single `useReducer` owns all domain state. A `commit()` function persists
changed slices via `writeLS` then dispatches to the reducer.

```js
import { readLS, writeLS } from '../storage/index.js';
import * as ops from './operations.js';
import {
  LS_TEMPLATES, LS_WORKOUTS, LS_SCHEDULE,
  LS_WORKOUT_LOGS, LS_YOUTUBE_LINKS, LS_ACTIVE_SESSION,
} from '../constants.js';

// ── State shape ─────────────────────────────────────────

/**
 * @typedef {Object} DataState
 * @property {Object} templates     - id → template
 * @property {Object} workouts      - name → workout
 * @property {Object} schedule      - date → workoutTitle
 * @property {Object} logs          - logKey → log
 * @property {Object} youtubeLinks  - exerciseTitle → url
 * @property {Object|null} activeSession - crash recovery session
 */

function initState() {
  return {
    templates:     readLS(LS_TEMPLATES, {}),
    workouts:      readLS(LS_WORKOUTS, {}),
    schedule:      readLS(LS_SCHEDULE, {}),
    logs:          readLS(LS_WORKOUT_LOGS, {}),
    youtubeLinks:  readLS(LS_YOUTUBE_LINKS, {}),
    activeSession: readLS(LS_ACTIVE_SESSION, null),
  };
}

// ── Reducer ─────────────────────────────────────────────

// Maps state keys to localStorage keys
const LS_KEY_MAP = {
  templates:     LS_TEMPLATES,
  workouts:      LS_WORKOUTS,
  schedule:      LS_SCHEDULE,
  logs:          LS_WORKOUT_LOGS,
  youtubeLinks:  LS_YOUTUBE_LINKS,
  activeSession: LS_ACTIVE_SESSION,
};

function reducer(state, action) {
  switch (action.type) {
    case 'COMMIT':
      // Merge only the changed slices into state
      return { ...state, ...action.payload };
    case 'RELOAD_ALL':
      return initState();
    default:
      return state;
  }
}

// ── Hook ────────────────────────────────────────────────

export function useDataStore() {
  const [state, dispatch] = useReducer(reducer, null, initState);

  // Persist changed slices → update React state (synchronous)
  const commit = useCallback((changes) => {
    for (const [key, value] of Object.entries(changes)) {
      if (key in LS_KEY_MAP) {
        writeLS(LS_KEY_MAP[key], value);
      }
    }
    dispatch({ type: 'COMMIT', payload: changes });
  }, []);

  // ── Derived data (memoized) ───────────────────────────

  const templateList = useMemo(() =>
    Object.values(state.templates)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [state.templates]
  );

  const completedDates = useMemo(() => {
    const dates = new Set();
    Object.values(state.logs).forEach(log => {
      if (log.completedAt) {
        const date = log.logKey
          ? log.logKey.split('::')[0]
          : log.date;
        if (date) dates.add(date);
      }
    });
    return dates;
  }, [state.logs]);

  const allLogs = useMemo(() =>
    Object.values(state.logs)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [state.logs]
  );

  // ── Actions (stable refs via useCallback + commit) ────

  const actions = useMemo(() => ({
    // ── Orchestrated (delegate to pure ops) ─────────

    deleteTemplate(id) {
      const changes = ops.deleteTemplate(id, state);
      if (Object.keys(changes).length) commit(changes);
    },

    renameTemplate(id, newName) {
      const result = ops.renameTemplate(id, newName, state);
      if (result.error) return result;
      commit(result);
      return result;
    },

    setWorkoutDate(dateStr, workoutTitle) {
      const changes = ops.setWorkoutDate(dateStr, workoutTitle, state);
      if (Object.keys(changes).length) commit(changes);
    },

    applyPlan(dateMap) {
      const changes = ops.applyPlan(dateMap, state);
      if (Object.keys(changes).length) commit(changes);
    },

    importWorkouts(workoutMap, scheduleMap) {
      const changes = ops.importWorkouts(workoutMap, scheduleMap, state);
      commit(changes);
    },

    saveTemplateEdit(original, updated) {
      const result = ops.saveTemplateEdit(original, updated, state);
      if (result.error) return result;
      commit(result);
      return result;
    },

    updateExerciseNotesGlobal(exerciseTitle, notes) {
      commit(ops.updateExerciseNotesGlobal(exerciseTitle, notes, state));
    },

    updateExerciseNotesInWorkout(workoutTitle, exerciseTitle, notes) {
      commit(ops.updateExerciseNotesInWorkout(
        workoutTitle, exerciseTitle, notes, state));
    },

    saveAsTemplate(workout) {
      const result = ops.validateSaveAsTemplate(workout, state);
      if (result.error) return result;
      const id = `tpl_${Date.now()}`;
      const newTemplates = {
        ...state.templates,
        [id]: {
          id,
          name: workout.title,
          createdDate: new Date().toISOString(),
          blocks: workout.blocks,
          notes: workout.notes || '',
        },
      };
      commit({ templates: newTemplates });
      return { valid: true };
    },

    // ── Direct data writes (no orchestration) ───────

    saveLog(logKey, logData) {
      commit({ logs: { ...state.logs, [logKey]: logData } });
    },

    deleteLog(logKey) {
      const newLogs = { ...state.logs };
      delete newLogs[logKey];
      commit({ logs: newLogs });
    },

    setYouTubeLink(exerciseKey, url) {
      const newLinks = { ...state.youtubeLinks };
      if (url) newLinks[exerciseKey] = url;
      else delete newLinks[exerciseKey];
      commit({ youtubeLinks: newLinks });
    },

    setManyYouTubeLinks(entries) {
      const newLinks = { ...state.youtubeLinks };
      entries.forEach(([key, url]) => {
        if (url) newLinks[key] = url;
        else delete newLinks[key];
      });
      commit({ youtubeLinks: newLinks });
    },

    duplicateTemplate(id) {
      const tpl = state.templates[id];
      if (!tpl) return;
      const newId = `tpl_${Date.now()}`;
      const newTemplates = {
        ...state.templates,
        [newId]: { ...tpl, id: newId, name: `${tpl.name} (Copy)` },
      };
      commit({ templates: newTemplates });
    },

    createSession(logKey, startedAt) {
      commit({ activeSession: { logKey, startedAt } });
    },

    updateSession(updates) {
      commit({ activeSession: { ...state.activeSession, ...updates } });
    },

    clearSession() {
      commit({ activeSession: null });
    },

    // ── Bulk operations (backup/restore, sync) ──────

    reloadFromStorage() {
      dispatch({ type: 'RELOAD_ALL' });
    },

    bulkWrite(keyValuePairs) {
      // For restore: write multiple slices at once
      const changes = {};
      for (const [key, value] of Object.entries(keyValuePairs)) {
        const stateKey = Object.entries(LS_KEY_MAP)
          .find(([, lsKey]) => lsKey === key)?.[0];
        if (stateKey) changes[stateKey] = value;
      }
      commit(changes);
    },
  }), [state, commit]);

  // ── Query helpers (stable refs) ───────────────────

  const queries = useMemo(() => ({
    getWorkoutForDate(date) {
      return state.schedule[date] || null;
    },
    getLog(logKey) {
      return state.logs[logKey] || null;
    },
    getYouTubeLink(exerciseKey) {
      return state.youtubeLinks[exerciseKey] || null;
    },
  }), [state.schedule, state.logs, state.youtubeLinks]);

  return {
    // State slices (read-only)
    ...state,
    // Derived
    templateList,
    completedDates,
    allLogs,
    // Actions
    ...actions,
    // Queries
    ...queries,
  };
}
```

### Layer 3: `src/data/DataProvider.jsx`

Split into 3 contexts to control re-render blast radius.

```js
import { createContext, useContext, useMemo } from 'react';
import { useDataStore } from './useDataStore.js';
import { useSync } from '../hooks/useSync.js';
import { useSettings } from '../hooks/useSettings.js';

const DataStateContext  = createContext(null);
const DataActionContext = createContext(null);
const SyncContext       = createContext(null);

export function DataProvider({ children }) {
  const store = useDataStore();

  // Separate state from actions for re-render control.
  // Actions object only changes when state changes (due to useMemo dep),
  // but action-only consumers can use useActions() which is more stable.
  const dataState = useMemo(() => ({
    templates:      store.templates,
    workouts:       store.workouts,
    schedule:       store.schedule,
    logs:           store.logs,
    youtubeLinks:   store.youtubeLinks,
    activeSession:  store.activeSession,
    templateList:   store.templateList,
    completedDates: store.completedDates,
    allLogs:        store.allLogs,
  }), [
    store.templates, store.workouts, store.schedule,
    store.logs, store.youtubeLinks, store.activeSession,
    store.templateList, store.completedDates, store.allLogs,
  ]);

  // Actions + queries are stable across renders (same commit ref).
  const dataActions = useMemo(() => ({
    deleteTemplate:              store.deleteTemplate,
    renameTemplate:              store.renameTemplate,
    setWorkoutDate:              store.setWorkoutDate,
    applyPlan:                   store.applyPlan,
    importWorkouts:              store.importWorkouts,
    saveTemplateEdit:            store.saveTemplateEdit,
    updateExerciseNotesGlobal:   store.updateExerciseNotesGlobal,
    updateExerciseNotesInWorkout:store.updateExerciseNotesInWorkout,
    saveAsTemplate:              store.saveAsTemplate,
    saveLog:                     store.saveLog,
    deleteLog:                   store.deleteLog,
    setYouTubeLink:              store.setYouTubeLink,
    setManyYouTubeLinks:         store.setManyYouTubeLinks,
    duplicateTemplate:           store.duplicateTemplate,
    createSession:               store.createSession,
    updateSession:               store.updateSession,
    clearSession:                store.clearSession,
    reloadFromStorage:           store.reloadFromStorage,
    bulkWrite:                   store.bulkWrite,
    getWorkoutForDate:           store.getWorkoutForDate,
    getLog:                      store.getLog,
    getYouTubeLink:              store.getYouTubeLink,
  }), [store]);

  // Sync is on its own context — pushes update frequently.
  const sync = useSync();
  const settings = useSettings();
  const syncValue = useMemo(() => ({
    ...sync, settings, updateSettings: settings.updateSettings,
  }), [sync, settings]);

  return (
    <DataStateContext.Provider value={dataState}>
      <DataActionContext.Provider value={dataActions}>
        <SyncContext.Provider value={syncValue}>
          {children}
        </SyncContext.Provider>
      </DataActionContext.Provider>
    </DataStateContext.Provider>
  );
}

// ── Consumer hooks ──────────────────────────────────────

/** All domain data — re-renders on any data change. */
export function useData() {
  const ctx = useContext(DataStateContext);
  if (!ctx) throw new Error('useData() requires <DataProvider>');
  return ctx;
}

/** All actions — re-renders less frequently. */
export function useActions() {
  const ctx = useContext(DataActionContext);
  if (!ctx) throw new Error('useActions() requires <DataProvider>');
  return ctx;
}

/** Convenience: data + actions together (most views). */
export function useStore() {
  return { ...useData(), ...useActions() };
}

/** Sync status + settings — isolated from domain data. */
export function useSyncStatus() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncStatus() requires <DataProvider>');
  return ctx;
}
```

### Barrel export: `src/data/index.js`

```js
export { DataProvider, useStore, useData, useActions, useSyncStatus } from './DataProvider.jsx';
export * as operations from './operations.js';
```

---

## 2. Usage Examples

### App.jsx — Before (840 LOC) → After (~80 LOC)

```jsx
// src/App.jsx — AFTER refactor
import { DataProvider, useStore, useSyncStatus } from './data/index.js';

function AppContent() {
  const [navState, setNavState] = useState({ view: ROUTE_TRAINING, params: {} });
  const [toast, showToast] = useToast();  // extract toast to tiny hook
  const store = useStore();
  const { syncStatus } = useSyncStatus();

  const navigate = (view, params = {}) => setNavState({ view, params });

  // Crash recovery — the one piece of UI logic that stays
  const [showRecovery, setShowRecovery] = useState(
    () => store.activeSession !== null
  );

  let currentView;
  switch (navState.view) {
    case ROUTE_TRAINING:
      currentView = <TrainingView navigate={navigate} showToast={showToast} />;
      break;
    case ROUTE_EDIT_TEMPLATE:
      currentView = (
        <TemplateEditorView
          templateId={navState.params.id}
          navigate={navigate}
          showToast={showToast}
        />
      );
      break;
    case ROUTE_ACTIVE_WORKOUT:
      currentView = (
        <ActiveWorkoutView
          logKey={navState.params.logKey}
          navigate={navigate}
          showToast={showToast}
        />
      );
      break;
    case ROUTE_IMPORT:
      currentView = (
        <ImportView
          onImport={(workoutMap, scheduleMap) => {
            store.importWorkouts(workoutMap, scheduleMap);
            navigate(ROUTE_TRAINING);
            showToast(`Imported ${Object.keys(workoutMap).length} workouts!`);
          }}
        />
      );
      break;
    // ... other routes — each 3-5 lines
  }

  return (
    <>
      {showRecovery && <CrashRecoveryModal ... />}
      {currentView}
      <NavBar navState={navState} navigate={navigate} />
      {toast && <Toast {...toast} />}
    </>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
```

### TrainingView — Before (14 props) → After (2 props + useStore)

```jsx
// src/views/TrainingView.jsx — AFTER
import { useStore } from '../data/index.js';

export default function TrainingView({ navigate, showToast }) {
  const {
    workouts, schedule, completedDates,
    getWorkoutForDate, getLog, getYouTubeLink, setYouTubeLink,
    updateExerciseNotesInWorkout, saveAsTemplate,
  } = useStore();

  const [currentDate, setCurrentDate] = useState(todayISO());
  const workoutTitle = getWorkoutForDate(currentDate);
  const workout = workouts[workoutTitle];

  const handleSaveAsTemplate = (w) => {
    const result = saveAsTemplate(w);
    if (result.error) showToast('Template already exists', 'error');
    else showToast('Template saved!');
  };

  // ... rest of view unchanged
}
```

### TemplateEditorView — Before (4 props + complex onSave) → After

```jsx
// src/views/TemplateEditorView.jsx — AFTER
import { useStore } from '../data/index.js';

export default function TemplateEditorView({ templateId, navigate, showToast }) {
  const { templates, saveTemplateEdit } = useStore();
  const template = templates[templateId];

  const handleSave = (updated) => {
    const result = saveTemplateEdit(template, updated);
    if (result.error === 'duplicate_name') {
      showToast('A template with this name already exists', 'error');
      return;
    }
    navigate(ROUTE_SETTINGS);
    showToast('Template saved!');
  };

  // ... render form
}
```

---

## 3. What Complexity It Hides

| Concern | Where it lived | Where it moves |
|---------|---------------|----------------|
| Orphan cleanup (3 duplicates) | App.jsx L87, L246, L288 | `operations.isWorkoutOrphan()` — one function, used by `deleteTemplate`, `setWorkoutDate`, `applyPlan` |
| Template name collision check (3 duplicates) | App.jsx L310, L614, L438 | `operations.hasNameCollision()` — one function |
| Schedule cascade on rename (2 duplicates) | App.jsx L321, L640 | Inside `operations.renameTemplate()` and `operations.saveTemplateEdit()` |
| Workout creation from template | App.jsx L235, L278 | Inside `operations.setWorkoutDate()` and `operations.applyPlan()` |
| Import merge preserving workoutNotes | App.jsx L355-397 | `operations.importWorkouts()` |
| Cross-hook coordination (all 9 callbacks) | App.jsx 260 LOC | `operations.js` pure functions + `useDataStore` commit |
| Prop drilling (6-14 props per view) | App.jsx switch block | Context via `useStore()` |
| Derived data (templateList, completedDates, allLogs) | Individual hooks | Memoized in `useDataStore()` |

**App.jsx retains only:** navigation state, toast state, crash recovery modal, route → view mapping.

---

## 4. Dependency Strategy

### How hooks/state/writeLS are handled

```
                    ┌───────────────────┐
                    │  operations.js    │  ← Zero dependencies.
                    │  Pure functions.  │     Takes plain objects,
                    │  No imports.      │     returns plain objects.
                    └────────┬──────────┘
                             │ imported by
                    ┌────────▼──────────┐
                    │  useDataStore.js  │  ← Imports: operations.js,
                    │  useReducer       │     readLS, writeLS,
                    │  + commit()       │     constants (LS_* keys)
                    └────────┬──────────┘
                             │ used by
                    ┌────────▼──────────┐
                    │  DataProvider.jsx  │  ← Imports: useDataStore,
                    │  3 Contexts       │     useSync, useSettings
                    └────────┬──────────┘
                             │ provides to
                    ┌────────▼──────────┐
                    │  Views            │  ← Import: useStore/useData/
                    │  App.jsx          │     useActions from data/
                    └───────────────────┘
```

**Key rule:** `operations.js` has **zero imports**. It doesn't know about React,
localStorage, writeLS, or any hook. It takes `{ templates, workouts, schedule, logs }`
as plain objects and returns `{ templates?, workouts? }` as plain objects.

**`commit()` is the only function that calls `writeLS`.** This is a single chokepoint
for all persistence, which means:
- The writeLS → pushToServer → debounce → sync pipeline is preserved unchanged
- Every write goes through the same path
- Testing `operations.js` never touches storage

**Existing hooks are retired** — their logic is absorbed into `useDataStore`:
- `useWorkouts`, `useSchedule`, `useTemplates`, `useWorkoutLogs`, `useYouTubeLinks`,
  `useActiveWorkout` → all replaced by `useReducer` in `useDataStore`
- `useSync`, `useSettings` → remain as separate hooks (different concern)

### writeLS contract preserved

```
View calls store.renameTemplate("id", "New Name")
  → operations.renameTemplate(id, newName, state)
    → returns { templates: {...}, schedule: {...}, workouts: {...} }
  → commit({ templates, schedule, workouts })
    → writeLS(LS_TEMPLATES, templates)    // → pushToServer debounced
    → writeLS(LS_SCHEDULE, schedule)      // → pushToServer debounced
    → writeLS(LS_WORKOUTS, workouts)      // → pushToServer debounced
    → dispatch({ type: 'COMMIT', payload: { templates, schedule, workouts } })
  → React re-renders consumers of DataStateContext
```

---

## 5. Trade-offs

### Context + Re-renders

| Pro | Con |
|-----|-----|
| Eliminates prop drilling (6-14 props → 0) | Any data write re-renders all `useData()` consumers |
| Views are self-contained (testable in isolation) | 3 contexts add indirection |
| Actions context is more stable than data context | `useStore()` convenience hook defeats the split |

**Mitigation:** The app has <10 views, only 1 mounted at a time (no router). Re-render
blast radius is effectively 1 view + NavBar. This is acceptable for a PWA.

**If it becomes a problem:** Replace `useStore()` with granular `useData()`/`useActions()`
in hot paths, or adopt `useSyncExternalStore` later.

### Single useReducer vs. Separate Hooks

| Pro | Con |
|-----|-----|
| One state = no snapshot staleness | Must recompute derived data (templateList, etc.) |
| Atomic commits across slices | Larger state object in memory |
| Single commit path = easy to audit | Migration is all-or-nothing for hooks |
| `RELOAD_ALL` for sync pull is trivial | Lose hook-level code organization |

### Pure Operations Layer

| Pro | Con |
|-----|-----|
| 100% testable without React or mocking | Extra indirection (action → op → commit) |
| TDD-friendly: test ops first, wire later | Must pass full state snapshot (verbose) |
| Orphan cleanup deduplicated to 1 function | Error handling split between ops and actions |
| Can be used outside React (scripts, CLI) | |

### Testing Strategy

```
┌─────────────────────────────────────────────────────┐
│  operations.test.js  (heavy)                        │
│  • Every operation with edge cases                  │
│  • Orphan cleanup logic                             │
│  • Name collision detection                         │
│  • Import merging with workoutNotes preservation    │
│  • Pure input → output, no mocking needed           │
│  └── 50-80 tests                                    │
├─────────────────────────────────────────────────────┤
│  useDataStore.test.js  (medium)                     │
│  • renderHook + act()                               │
│  • commit() writes to localStorage correctly        │
│  • Actions wire to correct operations               │
│  • Derived data (templateList, completedDates)      │
│  • reloadFromStorage after sync pull                │
│  └── 20-30 tests                                    │
├─────────────────────────────────────────────────────┤
│  DataProvider.test.jsx  (light)                     │
│  • Context provides data to consumers               │
│  • useStore/useData/useActions return expected shape │
│  • Error thrown outside provider                     │
│  └── 5-10 tests                                     │
└─────────────────────────────────────────────────────┘
```

**Key insight:** The hardest logic (orchestration, cascading, orphan cleanup) is tested
without React. The React layer is thin enough that wiring tests + a few integration
tests cover it.

### Migration Path

**This is all-or-nothing for hook ownership** (per critic finding #2). You cannot
have App.jsx instantiating old hooks alongside DataProvider instantiating new ones —
they'd be two independent state stores initialized from the same localStorage snapshot,
drifting apart on first write.

**Recommended sequence:**
1. Write + test `operations.js` (pure functions, TDD, zero risk)
2. Write + test `useDataStore.js` (replaces all 6 data hooks)
3. Write `DataProvider.jsx` + consumer hooks
4. Migrate `App.jsx` to use `DataProvider` (one commit, removes ~260 LOC)
5. Migrate views one-by-one to use `useStore()` instead of props
   (views can still receive props from App during transition —
   but App gets them from `useStore()`, not from parallel hooks)

---

## File Inventory (new files)

```
src/data/
  operations.js          ← Pure orchestration functions (~200 LOC)
  operations.test.js     ← Heavy test suite (~400 LOC)
  useDataStore.js        ← Single useReducer hook (~180 LOC)
  useDataStore.test.js   ← renderHook tests (~150 LOC)
  DataProvider.jsx       ← 3 Contexts + consumer hooks (~80 LOC)
  DataProvider.test.jsx  ← Light integration tests (~50 LOC)
  index.js               ← Barrel export (~5 LOC)
```

**Estimated total:** ~500 LOC production, ~600 LOC tests.
**Removed from App.jsx:** ~260 LOC orchestration + ~80 LOC prop passing = ~340 LOC.
**Net:** App.jsx shrinks from ~840 to ~80 LOC. 6 hook files retired.
