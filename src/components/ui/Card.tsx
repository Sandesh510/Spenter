import type { HTMLAttributes, ReactNode } from 'react';

type Variant = 'default' | 'compact' | 'flush' | 'group';

interface Props extends HTMLAttributes<HTMLElement> {
  variant?: Variant;
  as?: 'div' | 'section' | 'button';
  disabled?: boolean;
  children?: ReactNode;
}

/** The one surface. flush removes padding (for lists inside a card); group is the rounded settings group. */
export function Card({ variant = 'default', as: Tag = 'div', className = '', ...rest }: Props) {
  const classes = ['card', variant !== 'default' && `card--${variant}`, className].filter(Boolean).join(' ');
  return <Tag className={classes} {...rest} />;
}
