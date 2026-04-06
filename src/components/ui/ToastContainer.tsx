import { useToastStore } from '@/stores/toast-store';
import type { ToastType } from '@/stores/toast-store';

const TYPE_STYLES: Record<ToastType, string> = {
  info: 'border-daw-text-dim/30 text-daw-text-dim',
  success: 'border-emerald-500/40 text-emerald-400',
  warning: 'border-[#F77F00]/40 text-[#F77F00]',
  error: 'border-[#E63946]/40 text-[#E63946]',
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-1.5 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2 px-3 py-2
                      bg-daw-surface/95 backdrop-blur-sm border text-xxs font-mono
                      shadow-lg animate-slide-in ${TYPE_STYLES[t.type]}`}
          role="alert"
        >
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="text-daw-text-muted/40 hover:text-daw-text shrink-0"
            aria-label="Dismiss notification"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
