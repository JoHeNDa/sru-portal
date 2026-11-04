'use client';
import { useEffect, useRef } from 'react';
import { playUiSound } from '@/lib/ui-sound';

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'success' | 'neutral';
};

type Props = ConfirmOptions & {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
};

const TONE = {
  danger: { button: 'button-danger', header: 'text-red-700', icon: '⚠' },
  success: { button: 'button-success', header: 'text-green-700', icon: '✓' },
  neutral: { button: 'button-primary', header: 'text-gray-900', icon: '?' },
};

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'neutral',
  onConfirm,
  onCancel,
  busy = false,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
      if (event.key !== 'Tab') return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    cancelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
      returnFocusRef.current?.focus();
    };
  }, [open, busy, onCancel]);

  if (!open) return null;
  const theme = TONE[tone];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="w-full max-w-md animate-rise-in rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-semibold ${theme.header} bg-gray-50 border border-gray-200`}
          >
            {theme.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className={`text-base font-semibold ${theme.header}`}>
              {title}
            </h2>
            <p id="confirm-message" className="mt-1 whitespace-pre-line text-sm leading-6 text-gray-600">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="button-neutral px-3 py-2 text-sm disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              playUiSound(tone === 'danger' ? 'delete' : 'success');
              onConfirm();
            }}
            disabled={busy}
            className={`${theme.button} px-3 py-2 text-sm disabled:opacity-50`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
