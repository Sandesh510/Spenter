import { useEffect, type ReactNode } from 'react';

/** A panel that slides up from the bottom of the phone screen, over a dimmed backdrop. Escape or a tap outside closes it. */
export function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" className="sheet__scrim" onClick={onClose} aria-label="Close" tabIndex={-1} />
      <div className="sheet__panel pop">{children}</div>
    </div>
  );
}
