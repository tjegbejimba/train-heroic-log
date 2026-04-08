/**
 * Template validation — pure functions for TemplateEditorView.
 *
 * Extracts the save-validation logic so it can be tested independently
 * of React rendering.
 */

/**
 * Validate and clean a template before saving.
 *
 * @param {string} name - Template name
 * @param {Array} blocks - Array of block objects with exercises
 * @returns {{ cleanBlocks: Array|null, discardedCount: number, error: string|null }}
 */
export function validateTemplate(name, blocks) {
  if (!name.trim()) {
    return { cleanBlocks: null, discardedCount: 0, error: 'Template name is required' };
  }

  let discardedCount = 0;
  const cleanBlocks = blocks
    .map((block) => {
      const validExercises = block.exercises.filter((ex) => ex.title.trim());
      discardedCount += block.exercises.length - validExercises.length;
      return { ...block, exercises: validExercises };
    })
    .filter((block) => block.exercises.length > 0);

  if (cleanBlocks.length === 0) {
    return {
      cleanBlocks: null,
      discardedCount,
      error: 'Add at least one exercise with a name to save',
    };
  }

  return { cleanBlocks, discardedCount, error: null };
}
