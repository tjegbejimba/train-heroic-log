# TrainLog agent guide

Use this interface to read synced exercises and training history, create workout
versions, and schedule them. Do not edit NAS JSON files or use the general data
API to bypass coach safeguards.

## Install once on a trusted tailnet device

Requires Node.js 20+ and Tailscale access to the NAS. No npm dependencies, browser
automation, MCP server, SSH access, or NAS filesystem access are needed.

```bash
curl --fail --show-error --silent \
  https://tjnas.tail217062.ts.net:8443/api/coach/cli -o trainlog.mjs
node trainlog.mjs guide
node trainlog.mjs context
```

The guide command returns this Markdown in JSON's `instructions` field. All
commands except help emit JSON to stdout; failures emit JSON to stderr and exit
with code 1. `TRAINLOG_URL` or `--url URL` overrides the default URL; a trailing
`/api` is accepted. Requests time out after 15 seconds.

## Coaching loop

1. Run `node trainlog.mjs context` before planning. Save its `revision`.
2. Read exact exercise titles, existing prescriptions, global `formNotes`,
   workout-specific `workoutNotes`, schedule, completed `history`, active session,
   and unresolved conflicts. History contains actual logged sets, not derived
   PR/volume reports; preserve units when interpreting it.
3. Create a JSON plan using that revision as `baseRevision`. Reuse exact exercise
   titles to keep history together. New movements are allowed; inspect identity
   warnings rather than accidentally creating spelling variants.
4. Run `node trainlog.mjs plan check plan.json`. Review `added`, `scheduled`,
   `replacements`, and `warnings`. Check does not write.
5. Run `node trainlog.mjs plan apply plan.json`. Apply checks again and commits
   templates, workout definitions, and schedule together. Read context afterward.

After HTTP 409, re-read context and review what changed before revising the plan.
**Never just substitute a new revision token and retry an unreviewed plan.**

## Plan format

Run `node trainlog.mjs schema` for the authoritative JSON Schema. Both `templates`
and `schedule` are required but may be empty. Replace the placeholder revision
and example date below with the current context revision and an intended date
on or after `context.today`.

```json
{
  "baseRevision": "COPY_CONTEXT_REVISION_HERE",
  "templates": [{
    "name": "Upper A - Week 2",
    "notes": "Progression: add reps before load",
    "blocks": [{
      "exercises": [{
        "title": "Bench Press",
        "workoutNotes": "Pause each rep; rest 90 seconds",
        "unit": "kg",
        "sets": [
          {"reps": 8, "weight": 60},
          {"reps": 8, "weight": 60},
          {"reps": 8, "weight": 60}
        ]
      }]
    }]
  }],
  "schedule": {"2026-11-03": "Upper A - Week 2"},
  "replaceScheduled": true
}
```

- A `block` is a workout **part**. Multiple exercises within a part form a
  **superset**. Order parts and exercises in the intended training sequence.
- Existing exact workout/template names may be reused only for identical
  prescriptions. Changes require separately named versions. Old versions,
  completed history, and active sessions are not rewritten.
- New templates are also materialized as workouts, even without scheduled dates,
  so their exercises appear in the Library.
- `schedule` assigns exact workout titles to real `YYYY-MM-DD` dates. The coach
  calendar is **America/Los_Angeles**. Today is allowed until a session has
  started; past dates and dates with any started/completed log are protected.
- Changing an occupied date requires `replaceScheduled: true`. It authorizes
  only the dates listed in this plan, not replacing the whole calendar.
- Each set needs positive `reps` or nonempty `rawReps` (for example
  `{"reps": null, "rawReps": "AMRAP", "unit": "bw"}`). Weight is nonnegative or
  null. Supported units: `lb`, `kg`, `bw`, `reps`, `%`, `yd`, `m`, `RPE`, `in`,
  `ft`, `sec`. Specify exercise units explicitly; individual sets can override
  them. No unit conversion is performed.
- Do not repeat an exercise title within one workout: the logging model cannot
  distinguish two separately prescribed occurrences. Add its sets to the same
  exercise instead.
- Limits: 100 templates, 100 parts/template, 20 exercises/part, 100 sets/exercise,
  366 scheduled dates, 200-character names, and 10,000-character note fields.
- Identical apply retries succeed while data still matches the application
  receipt. If data changed afterward, refresh and review instead.

Files can be replaced with `-` to read JSON from stdin.

## Global form notes are an explicit operation

`exercise.notes` holds global coaching cues. `exercise.workoutNotes` holds
instructions for this workout only. Plan creation inherits existing form notes;
it does not change them. For a genuinely new exercise, a plan may supply `notes`.
That first cue is shared when the same new exercise appears in other versions
within the plan; a differing supplied cue produces a warning rather than a
second global definition.

To deliberately update global form notes across all current workouts/templates:

```json
{
  "baseRevision": "COPY_CONTEXT_REVISION_HERE",
  "exerciseTitle": "Bench Press",
  "notes": "Keep wrists stacked and feet planted"
}
```

```bash
node trainlog.mjs notes set notes.json
```

Read a fresh revision first. This preserves workout-specific instructions,
completed history, and pinned session prescriptions. If several existing global
cues differ, review them before choosing a replacement. Notes requests require
a fresh revision after a successful update; after a lost response, read context
to determine whether the intended notes already landed.

## App synchronization and conflicts

The app receives coach changes automatically while online and idle. Editing,
dialogs, imports, and active/recoverable workouts defer application. Started
sessions keep an independent prescription snapshot, including crash recovery.

Unrelated offline edits merge. Overlapping proposals remain durable and are
presented side by side in the app; the current server value remains effective
until the user chooses. On initial upgrade, a device with differing local data
but no known baseline asks the user to review the complete section rather than
guess which missing entries were deletions.

```bash
node trainlog.mjs conflicts
```

Resolve conflicts in TrainLog. `GET /api/sync/conflicts?resolved=1` includes
resolved proposals and the losing choice for recovery. The archive is not a
one-click rollback tool. The agent must not auto-resolve conflicts to force a
plan through.

## HTTP surface and failures

The CLI wraps these endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/coach/context` | Revision, exercises, prescriptions, schedule, completed logs |
| GET | `/api/coach/schema` | Plan JSON Schema |
| GET | `/api/coach/guide` | This guide as JSON |
| GET | `/api/coach/cli` | Standalone CLI download |
| POST | `/api/coach/plan/check` | Read-only validation and preview |
| POST | `/api/coach/plan/apply` | Revision-checked atomic plan commit |
| POST | `/api/coach/notes` | Explicit global form-note update |
| GET | `/api/sync/conflicts` | Unresolved proposals and current revision |

400 means invalid input; correct the payload. 404 means the requested exercise
or endpoint is absent. 413 means the request exceeds the API's 10 MB body limit.
409 means stale data, a version/date guard, or a pending
conflict; inspect fresh context. 428 rejects obsolete app writes after the first
coach write; refresh that app to upgrade sync. 503 means persistence is
unavailable or recovering: no success was confirmed, and a journaled operation
may still complete during recovery. Read context before deciding whether to
retry. Network errors do not prove a write failed.

## Trust and limitations

There is no separate coach login or authorization token. HTTPS protects transit;
Tailscale grants access. Any tailnet principal permitted to reach this app can
use its API. Restrict access with tailnet policy when necessary; do not publish
the app or these endpoints to the internet.

Only data synced to the NAS is visible. An offline phone may have started or
completed training that the server cannot yet know about. The phone preserves
that session and its completed-day view; synchronization preserves competing
edits for review. The server cannot promise knowledge of unsynced sessions.

Deploy frontend and backend together before using the coach. Old clients are
blocked after coach writes rather than allowed to erase coach-managed data.
Keep the data volume, `sync_metadata.json`, and pending transaction journal when
upgrading or rolling back; older server versions do not enforce these guards.
