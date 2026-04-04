import * as Tone from 'tone';
import type { AutomationLane } from '@/types/automation';
import { setTrackVolume, setTrackPan, setTrackMute } from './track-manager';

const scheduledEvents: number[] = [];

function denormalize(value: number, min: number, max: number): number {
  return min + value * (max - min);
}

export function getValueAtTime(lane: AutomationLane, time: number): number {
  const { points } = lane;
  if (points.length === 0) return 0.5;

  // Before first point
  if (time <= points[0]!.time) return points[0]!.value;

  // After last point
  const last = points[points.length - 1]!;
  if (time >= last.time) return last.value;

  // Find surrounding points
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;

    if (time >= a.time && time <= b.time) {
      if (a.curve === 'step') {
        return a.value;
      }

      const t = (time - a.time) / (b.time - a.time);

      if (a.curve === 'exponential') {
        // Exponential interpolation (clamped to avoid zero)
        const minVal = Math.max(a.value, 0.001);
        const maxVal = Math.max(b.value, 0.001);
        return minVal * Math.pow(maxVal / minVal, t);
      }

      // Linear interpolation
      return a.value + (b.value - a.value) * t;
    }
  }

  return last.value;
}

function applyValue(lane: AutomationLane, normalizedValue: number): void {
  const actual = denormalize(normalizedValue, lane.minValue, lane.maxValue);

  switch (lane.target) {
    case 'volume':
      setTrackVolume(lane.trackId, actual);
      break;
    case 'pan':
      setTrackPan(lane.trackId, actual);
      break;
    case 'mute':
      setTrackMute(lane.trackId, normalizedValue >= 0.5);
      break;
    default:
      // filterFrequency, filterResonance, effectParam
      // Extensible — consumers can handle these via getValueAtTime
      break;
  }
}

export function scheduleAutomation(lanes: AutomationLane[]): void {
  clearAutomation();

  const transport = Tone.getTransport();

  for (const lane of lanes) {
    if (!lane.enabled || lane.points.length === 0) continue;

    for (let i = 0; i < lane.points.length; i++) {
      const point = lane.points[i]!;
      const nextPoint = lane.points[i + 1];

      // Schedule the value change at this point's time
      const eventId = transport.schedule((time) => {
        Tone.getDraw().schedule(() => {
          applyValue(lane, point.value);
        }, time);
        applyValue(lane, point.value);
      }, point.time);
      scheduledEvents.push(eventId);

      // For linear/exponential curves, schedule intermediate updates
      if (nextPoint && point.curve !== 'step') {
        const duration = nextPoint.time - point.time;
        const steps = Math.max(1, Math.floor(duration * 30)); // ~30 updates/sec
        const stepTime = duration / steps;

        for (let s = 1; s < steps; s++) {
          const t = point.time + s * stepTime;
          const interpValue = getValueAtTime(lane, t);
          const eid = transport.schedule((time) => {
            Tone.getDraw().schedule(() => {
              applyValue(lane, interpValue);
            }, time);
            applyValue(lane, interpValue);
          }, t);
          scheduledEvents.push(eid);
        }
      }
    }
  }
}

export function clearAutomation(): void {
  const transport = Tone.getTransport();
  for (const eventId of scheduledEvents) {
    transport.clear(eventId);
  }
  scheduledEvents.length = 0;
}
