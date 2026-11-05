import { useEffect, useState } from 'react';

interface ConfirmButtonProps {
  label: string;
  confirmLabel: string;
  onConfirm(): void | Promise<void>;
}

/** A destructive action that needs a second click within a few seconds. */
export function ConfirmButton({ label, confirmLabel, onConfirm }: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);
  return (
    <button
      type="button"
      className={`opt-btn danger${armed ? ' confirm' : ''}`}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        void onConfirm();
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
