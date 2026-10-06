import { Button } from './Button';

/** Shown after a new entry is saved. Yes starts a fresh entry on the same date; No goes to the Log. */
export function AddAnotherPrompt({ date, onYes, onNo }: { date: string; onYes: () => void; onNo: () => void }) {
  const label = new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="abs inset-0 flex" role="dialog" aria-modal="true" aria-label="Add another transaction" style={{ zIndex: 30, flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--color-scrim)' }} />
      <div className="pop rel grid gap-10" style={{ background: 'var(--color-surface)', borderRadius: '18px 18px 0 0', padding: '18px 18px 26px', borderTop: '1px solid var(--color-border)' }}>
        <div className="kicker">Saved</div>
        <p className="fs-15 m-0">Add another transaction for the same date?</p>
        <p className="fs-13 c-sec m-0">{label}. Date and account stay as they are.</p>
        <Button block onClick={onYes}>Yes, add another</Button>
        <Button variant="secondary" block onClick={onNo}>No, go to Log</Button>
      </div>
    </div>
  );
}
