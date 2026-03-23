import { useState } from 'react';
import { LS_TEMPLATES } from '../constants';
import { readLS, writeLS } from '../storage/index';

/**
 * Hook for managing workout templates
 * Templates are stored as { [id]: { id, name, createdDate, blocks, notes } }
 */
export function useTemplates() {
  const [templates, setTemplates] = useState(() => {
    return readLS(LS_TEMPLATES, {});
  });

  function saveTemplates(templateMap) {
    writeLS(LS_TEMPLATES, templateMap);
    setTemplates(templateMap);
  }

  function saveTemplate(id, templateData) {
    const updated = { ...templates, [id]: templateData };
    saveTemplates(updated);
  }

  function deleteTemplate(id) {
    const updated = { ...templates };
    delete updated[id];
    saveTemplates(updated);
  }

  function renameTemplate(id, newName) {
    if (!templates[id]) return;
    const updated = { ...templates, [id]: { ...templates[id], name: newName } };
    saveTemplates(updated);
  }

  function duplicateTemplate(id) {
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
  }

  function createTemplateFromWorkout(workout) {
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
  }

  const templateList = Object.values(templates).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return {
    templates,
    templateList,
    saveTemplate,
    deleteTemplate,
    renameTemplate,
    duplicateTemplate,
    createTemplateFromWorkout,
  };
}
