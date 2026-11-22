import React, { useId } from 'react';

interface InputProps extends React.ComponentPropsWithRef<'input'> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({
  label,
  error,
  hint,
  id,
  className = '',
  'aria-describedby': externalDescribedBy,
  'aria-invalid': externalInvalid,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy =
    [externalDescribedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;
  const isInvalid = Boolean(error) || externalInvalid;

  return (
    <div className="flex flex-col gap-2 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider pl-1"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={isInvalid}
        aria-describedby={describedBy}
        className={`w-full bg-card rounded-xl px-4 py-3 shadow-sm outline-none focus:ring-2 text-foreground font-medium placeholder:text-muted-foreground transition-colors border appearance-none min-w-0 ${
          error
            ? 'border-error focus:ring-error focus:border-error'
            : 'border-border-strong focus:ring-primary focus:border-primary'
        } ${className}`}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground pl-1">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-semibold text-error pl-1">
          {error}
        </p>
      )}
    </div>
  );
}
