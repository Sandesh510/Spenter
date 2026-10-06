import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

/** The one button. Primary is the accent; use secondary for cancel-style actions and ghost for inline text links. */
export function Button({ variant = 'primary', size = 'md', block = false, className = '', type = 'button', ...rest }: Props) {
  const classes = ['btn', `btn--${variant}`, size !== 'md' && `btn--${size}`, block && 'btn--block', className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...rest} />;
}
