import { useMemo, useCallback } from 'react';
import { LS_TEMPLATES } from '../constants';
import { createEntityHook } from './createEntityHook';

const useTemplatesBase = createEntityHook(LS_TEMPLATES, {});

/**
 * Hook for managing workout templates
 * Templates are stored as { [id]: { id, name, createdDate, blocks, notes } }
 */
export function useTemplates() {
  const { data: templates, save: saveTemplates } = useTemplatesBase();

  const saveTemplate = useCallback((id, templateData) => {
    saveTemplates({ ...templates, [id]: templateData });
  }, [templates, saveTemplates]);

  const deleteTemplate = useCallback((id) => {
    const updated = { ...templates };
    delete updated[id];
    saveTemplates(updated);
  }, [templates, saveTemplates]);

  const renameTemplate = useCallback((id, newName) => {
    if (!templates[id]) return;
    saveTemplates({ ...templates, [id]: { ...templates[id], name: newName } });
  }, [templates, saveTemplates]);

  const duplicateTemplate = useCallback((id) => {
    if (!templates[id]) return;
    const original = templates[id];
    const newId = `tpl_${Date.now()}`;
    const copy = {
      ...original,
      id: newId,
      name: `${original.name} (Copy)`,
      createdDate: new Date().toISOString(),
    };
    saveTemplate(newId, copy);
    return newId;
  }, [templates, saveTemplate]);

  const createTemplateFromWorkout = useCallback((workout) => {
    const id = `tpl_${Date.now()}`;
    const template = {
      id,
      name: workout.title,
      createdDate: new Date().toISOString(),
      blocks: workout.blocks,
      notes: workout.notes || '',
    };
    saveTemplate(id, template);
    return id;
  }, [saveTemplate]);

  const templateList = useMemo(
    () => Object.values(templates).sort((a, b) => a.name.localeCompare(b.name)),
    [templates]
  );

  return {
    templates,
    templateList,
    saveTemplates,
    saveTemplate,
    deleteTemplate,
    renameTemplate,
    duplicateTemplate,
    createTemplateFromWorkout,
  };
}
