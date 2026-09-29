# TrainLog

TrainLog preserves a personal training program as reusable workouts and scheduled training sessions.

## Language

**Merge-only import**:
A partial TrainHeroic import that adds reusable templates and scheduled dates without removing existing data.
_Avoid_: Re-import, additive import

**Template conflict**:
An imported template and an existing template that share the same name but may contain different workout definitions. A conflict remains unresolved until the user chooses which definition or name to keep.
_Avoid_: Duplicate

**Import report**:
The current merge-only import's categorized record of imported items, items already present, and unresolved template or schedule conflicts.
_Avoid_: Import results

**Template**:
A reusable workout definition that is not tied to a date.
_Avoid_: Workout

**Scheduled workout**:
A reusable workout definition assigned to a specific calendar date and ready to run.
_Avoid_: Schedule entry

**Schedule conflict**:
An imported scheduled workout and an existing scheduled workout assigned to the same date with different templates. A conflict remains unresolved until the user chooses which scheduled workout to keep.
_Avoid_: Duplicate date

**Training history**:
The record of completed sessions, read to report on past training: records, volume, estimated 1RM, and per-exercise timelines.
_Avoid_: Stats, analytics, log history

**PR**:
A completed set whose weight beats the best earlier weight for the same exercise, rep count, and unit.
_Avoid_: Personal best, record (unqualified)

**Baseline**:
The first completed set recorded for an exercise, rep count, and unit; it sets the reference a later PR must beat but is not itself a PR.
_Avoid_: First PR

**Top-set record**:
A session whose heaviest completed set for an exercise beats every earlier session's heaviest set for that exercise, at any rep count.
_Avoid_: PR, weight PR

**Volume**:
The sum of reps × weight across completed sets, kept separately per weight unit (lb or kg); time-based and bodyweight sets have no volume.
_Avoid_: Tonnage, load
