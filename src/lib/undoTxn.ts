import { api } from './api';
import { refreshAll } from './cache';
import { haptic } from './haptics';

/** Takes back an entry that was just saved: the same soft delete as the Log, then the totals refresh. */
export async function undoTransaction(token: string, id: string): Promise<void> {
  await api(`transactions?id=${id}`, { method: 'DELETE', token });
  haptic('warning');
  await refreshAll(token).catch(() => {});
}

/** The toast action for a freshly saved entry; `done` runs after it is taken back. */
export function undoFor(token: string, id: string, done: (message: string) => void): () => void {
  return () => {
    undoTransaction(token, id).then(() => done('Entry removed'), () => done('Could not undo. Delete it from the Log.'));
  };
}
