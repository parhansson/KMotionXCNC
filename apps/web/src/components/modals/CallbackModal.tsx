import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, HelpCircle, Info, Terminal } from 'lucide-react';

export interface PendingCallbackItem {
  id: string;
  kind: 'USER' | 'USER_M_CODE' | 'MESSAGEBOX';
  title?: string;
  message: string;
  mCode?: number;
  buttons?: string[];
}

export interface CallbackModalProps {
  callback: PendingCallbackItem | null;
  onRespond: (id: string, result: number) => void;
}

/**
 * Non-blocking Radix Dialog for interpreter USER, USER_M_CODE, and MESSAGEBOX callbacks.
 * Replaces native browser alert()/confirm() so E-Stop and telemetry never freeze.
 */
export const CallbackModal: React.FC<CallbackModalProps> = ({ callback, onRespond }) => {
  if (!callback) return null;

  const isConfirm = callback.kind === 'USER' || callback.kind === 'USER_M_CODE';
  const Icon =
    callback.kind === 'MESSAGEBOX'
      ? Info
      : callback.kind === 'USER_M_CODE'
        ? Terminal
        : HelpCircle;

  return (
    <Dialog.Root open={true}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[1px]" />
        <Dialog.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-panel)] p-5 shadow-2xl focus:outline-none"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-bold text-[var(--text-primary)]">
                {callback.title ??
                  (callback.kind === 'USER_M_CODE'
                    ? `User M-Code Callback${callback.mCode != null ? ` (M${callback.mCode})` : ''}`
                    : callback.kind === 'USER'
                      ? 'Operator Confirmation Required'
                      : 'Controller Message')}
              </Dialog.Title>
              <Dialog.Description className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
                {callback.message}
              </Dialog.Description>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 rounded bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-[var(--accent-amber)]" />
              Non-blocking modal — telemetry &amp; E-Stop remain active
            </span>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            {isConfirm && (
              <button
                type="button"
                onClick={() => onRespond(callback.id, 1)}
                className="btn-workshop"
              >
                Cancel / Abort
              </button>
            )}
            <button
              type="button"
              onClick={() => onRespond(callback.id, 0)}
              className="btn-workshop !bg-[var(--accent-emerald)] !text-slate-950 !border-transparent hover:!brightness-110"
            >
              {isConfirm ? 'Continue (OK)' : 'Acknowledge'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
