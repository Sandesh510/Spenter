import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldProps {
  label?: string;
  /** A short help line under the control. */
  hint?: string | null;
  error?: string | null;
  children: ReactNode;
}

/** Label, control, help and error text in one column. Use it for any form input that needs a visible label. */
export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="field">
      {label && <span className="field__label">{label}</span>}
      {children}
      {hint && <span className="field__hint">{hint}</span>}
      {error && <span className="field__error" role="alert">{error}</span>}
    </label>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** A native drop-down in the boxed input style. Wrap it in a Field for its label. */
export function Select({ className = '', ...rest }: SelectProps) {
  return <select className={['input', 'input--boxed', 'input--select', className].filter(Boolean).join(' ')} {...rest} />;
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

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Multi-line text input in the boxed style, for pasted text. */
export function TextArea({ className = '', ...rest }: TextAreaProps) {
  return <textarea className={['input', 'input--boxed', 'input--area', className].filter(Boolean).join(' ')} {...rest} />;
}
