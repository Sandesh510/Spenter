import type { InputHTMLAttributes, ReactNode } from 'react';

interface FieldProps {
  label?: string;
  error?: string | null;
  children: ReactNode;
}

/** Label, control and error text in one column. Use it for any form input that needs a visible label. */
export function Field({ label, error, children }: FieldProps) {
  return (
    <label className="field">
      {label && <span className="field__label">{label}</span>}
      {children}
      {error && <span className="field__error" role="alert">{error}</span>}
    </label>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  boxed?: boolean;
  numeric?: boolean;
}

/** Text or number input. numeric applies tabular figures and decimal keyboard; boxed is the bordered card style used in pickers. */
export function Input({ boxed = false, numeric = false, className = '', ...rest }: InputProps) {
  const classes = ['input', boxed && 'input--boxed', numeric && 'num', className].filter(Boolean).join(' ');
  return <input className={classes} {...rest} />;
}
