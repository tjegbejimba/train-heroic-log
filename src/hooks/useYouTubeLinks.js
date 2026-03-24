import { useState } from 'react';
import { LS_YOUTUBE_LINKS } from '../constants';
import { readLS, writeLS } from '../storage/index';

/**
 * Hook for managing YouTube links per exercise
 * ExerciseKey format: "WorkoutTitle::ExerciseTitle"
 * @returns {{ links: Object, setLink: Function, removeLink: Function, getLink: Function }}
 */
export function useYouTubeLinks() {
  const [links, setLinks] = useState(() => {
    return readLS(LS_YOUTUBE_LINKS, {});
  });

  function saveLinks(linksMap) {
    writeLS(LS_YOUTUBE_LINKS, linksMap);
    setLinks(linksMap);
  }

  function setLink(exerciseKey, url) {
    const updated = { ...links };
    if (url && url.trim()) {
      updated[exerciseKey] = url.trim();
    } else {
      delete updated[exerciseKey];
    }
    saveLinks(updated);
  }

  // Save multiple links at once — avoids stale-closure overwrites when calling setLink in a loop
  function setManyLinks(entries) {
    const updated = { ...links };
    entries.forEach(({ key, url }) => {
      if (url && url.trim()) {
        updated[key] = url.trim();
      } else {
        delete updated[key];
      }
    });
    saveLinks(updated);
  }

  function removeLink(exerciseKey) {
    const updated = { ...links };
    delete updated[exerciseKey];
    saveLinks(updated);
  }

  function getLink(exerciseKey) {
    return links[exerciseKey] || null;
  }

  return { links, setLink, setManyLinks, removeLink, getLink };
}
