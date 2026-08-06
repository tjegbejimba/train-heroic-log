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
