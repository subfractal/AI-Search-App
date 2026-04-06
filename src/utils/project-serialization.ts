import { useSessionStore } from '@/stores/session-store';
import { useTransportStore } from '@/stores/transport-store';
import type { Track, SessionConfig } from '@/types/audio';

export interface ProjectData {
  name: string;
  version: string;
  tracks: Track[];
  config: SessionConfig;
  bpm: number;
  position: number;
  timestamp: number;
}

const PROJECT_STORAGE_KEY = 'dkst-project-autosave';
const PROJECT_NAME_STORAGE_KEY = 'dkst-project-name';

/**
 * Serializes the current session state to a ProjectData object
 */
export function serializeProject(projectName: string = 'Untitled Project'): ProjectData {
  const sessionState = useSessionStore.getState();
  const transportState = useTransportStore.getState();

  return {
    name: projectName,
    version: '1.0',
    tracks: sessionState.tracks,
    config: sessionState.config,
    bpm: transportState.bpm,
    position: transportState.position,
    timestamp: Date.now(),
  };
}

/**
 * Deserializes a ProjectData object and restores session state
 * Uses Zustand's internal state mutation for immediate restore
 */
export function deserializeProject(data: ProjectData): void {
  const transportStore = useTransportStore.getState();

  // Directly set the state by bypassing the individual actions
  useSessionStore.setState({
    tracks: data.tracks,
    config: data.config,
  });

  // Restore transport state
  transportStore.setBpm(data.bpm);
  transportStore.setPosition(data.position);

  // Store project name
  localStorage.setItem(PROJECT_NAME_STORAGE_KEY, data.name);
}

/**
 * Saves project to localStorage (auto-save)
 */
export function saveProjectToLocalStorage(projectName?: string): void {
  const name = projectName || localStorage.getItem(PROJECT_NAME_STORAGE_KEY) || 'Untitled Project';
  const projectData = serializeProject(name);
  try {
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projectData));
    localStorage.setItem(PROJECT_NAME_STORAGE_KEY, name);
  } catch (e) {
    console.error('Failed to save project to localStorage:', e);
  }
}

/**
 * Loads project from localStorage
 */
export function loadProjectFromLocalStorage(): ProjectData | null {
  try {
    const data = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as ProjectData;
  } catch (e) {
    console.error('Failed to load project from localStorage:', e);
    return null;
  }
}

/**
 * Clears auto-saved project from localStorage
 */
export function clearAutoSavedProject(): void {
  try {
    localStorage.removeItem(PROJECT_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear auto-saved project:', e);
  }
}

/**
 * Downloads project as .dkst JSON file
 */
export function downloadProject(projectName?: string): void {
  const name = projectName || localStorage.getItem(PROJECT_NAME_STORAGE_KEY) || 'Untitled Project';
  const projectData = serializeProject(name);

  const jsonString = JSON.stringify(projectData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}.dkst`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Triggers file input for loading a project
 */
export function loadProjectFile(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.dkst,application/json';
  input.onchange = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      readProjectFile(file);
    }
  };
  input.click();
}

/**
 * Reads and loads a project file
 */
export function readProjectFile(file: File): void {
  const reader = new FileReader();
  reader.onload = (e: any) => {
    try {
      const data = JSON.parse(e.target.result) as ProjectData;
      deserializeProject(data);
      console.log('Project loaded:', data.name);
    } catch (error) {
      console.error('Failed to parse project file:', error);
    }
  };
  reader.onerror = () => {
    console.error('Failed to read project file');
  };
  reader.readAsText(file);
}
