import { useCallback } from 'react';
import { LS_YOUTUBE_LINKS } from '../constants';
import { createEntityHook } from './createEntityHook';

const useLinksBase = createEntityHook(LS_YOUTUBE_LINKS, {});

/**
 * Hook for managing YouTube links per exercise
 */
export function useYouTubeLinks() {
  const { data: links, save: saveLinks } = useLinksBase();

  const setLink = useCallback((exerciseKey, url) => {
    const updated = { ...links };
    if (url && url.trim()) {
      updated[exerciseKey] = url.trim();
    } else {
      delete updated[exerciseKey];
    }
    saveLinks(updated);
  }, [links, saveLinks]);

  const setManyLinks = useCallback((entries) => {
    const updated = { ...links };
    entries.forEach(({ key, url }) => {
      if (url && url.trim()) {
        updated[key] = url.trim();
      } else {
        delete updated[key];
      }
    });
    saveLinks(updated);
  }, [links, saveLinks]);

  const removeLink = useCallback((exerciseKey) => {
    const updated = { ...links };
    delete updated[exerciseKey];
    saveLinks(updated);
  }, [links, saveLinks]);

  const getLink = useCallback((exerciseKey) => links[exerciseKey] || null, [links]);

  return { links, setLink, setManyLinks, removeLink, getLink };
}
