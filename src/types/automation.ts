export type AutomationTarget =
  | 'volume'
  | 'pan'
  | 'mute'
  | 'filterFrequency'
  | 'filterResonance'
  | 'effectParam';

export interface AutomationPoint {
  time: number;    // seconds
  value: number;   // normalized 0-1
  curve: 'linear' | 'exponential' | 'step';
}

export interface AutomationLane {
  id: string;
  trackId: string;
  target: AutomationTarget;
  effectId?: string;       // if targeting an effect param
  paramName?: string;      // specific param name for effects
  points: AutomationPoint[];
  enabled: boolean;
  visible: boolean;
  color: string;
  minValue: number;        // actual min (e.g., -60 for volume)
  maxValue: number;        // actual max (e.g., 6 for volume)
}

// --- Clip-level automation ---

export type ClipAutomationTarget =
  | 'gain'
  | 'pitch'
  | 'pan'
  | 'filterFrequency'
  | 'filterResonance'
  | 'playbackRate';

export interface ClipAutomationLane {
  id: string;
  clipId: string;
  trackId: string;
  target: ClipAutomationTarget;
  points: AutomationPoint[];
  enabled: boolean;
  color: string;
}

export interface ClipAutomationEnvelope {
  clipId: string;
  lanes: ClipAutomationLane[];
}
