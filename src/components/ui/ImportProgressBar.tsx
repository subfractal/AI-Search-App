import { useImportProgressStore } from '@/stores/import-progress-store';

const STAGE_LABELS = {
  decoding: 'Decoding audio',
  classifying: 'Classifying track',
  'analyzing-bpm': 'Detecting BPM',
  'analyzing-key': 'Detecting key',
  done: 'Complete',
} as const;

export default function ImportProgressBar() {
  const progress = useImportProgressStore((s) => s.current);

  if (!progress) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] pointer-events-none">
      {/* Progress bar track */}
      <div className="h-1 bg-daw-bg/80 w-full">
        <div
          className="h-full bg-[#E63946] transition-all duration-200 ease-out"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      {/* Label */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-daw-surface/95 border-b border-daw-border/30 backdrop-blur-sm">
        <div className="w-3 h-3 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
        <span className="text-[10px] font-mono text-daw-text-dim">
          {STAGE_LABELS[progress.stage]} — {progress.fileName}
        </span>
        <span className="text-[10px] font-mono text-daw-text-muted ml-auto">
          {Math.round(progress.percent)}%
        </span>
      </div>
    </div>
  );
}
