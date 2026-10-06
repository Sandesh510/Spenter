import type { ReactNode } from 'react';

type Tone = 'success' | 'info' | 'neutral';

/** A short status label. Tone maps to the semantic status families, never to a raw colour. */
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
