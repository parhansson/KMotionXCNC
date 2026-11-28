import React, { useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert, X } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';

export interface PwaUpdateBannerProps {
  machineState: string;
}

const SAFE_UPDATE_STATES = new Set(['idle', 'disconnected', 'offline']);

export const PwaUpdateBanner: React.FC<PwaUpdateBannerProps> = ({ machineState }) => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updateFn, setUpdateFn] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    try {
      const updateSW = registerSW({
        immediate: true,
        onRegisteredSW(_swUrl, registration) {
          void registration?.update();
        },
        onNeedRefresh() {
          setNeedRefresh(true);
          setDismissed(false);
        },
        onOfflineReady() {
          // App shell cached for offline launch
        },
      });
      setUpdateFn(() => updateSW);
    } catch {
      // Dev mode or non-SW environment
    }
  }, []);

  if (!needRefresh || dismissed) return null;

  const canActivate = SAFE_UPDATE_STATES.has(machineState);

  const handleUpdate = async () => {
    if (!canActivate || !updateFn) return;
    await updateFn(true);
  };

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2 text-xs"
    >
      <div className="flex items-center gap-2 text-[var(--text-primary)]">
        {canActivate ? (
          <RefreshCw className="h-4 w-4 text-[var(--accent-primary)]" />
        ) : (
          <ShieldAlert className="h-4 w-4 text-[var(--accent-amber)]" />
        )}
        <span>
          <strong>App update available.</strong>{' '}
          {canActivate
            ? 'Machine is in a safe state — you can reload to apply the update.'
            : `Update activation locked while machine is "${machineState}". Wait until idle/disconnected.`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canActivate}
          onClick={handleUpdate}
          className="btn-workshop !min-h-7 !px-3 !text-xs !bg-[var(--accent-primary)] !text-slate-950 !border-transparent hover:!bg-[var(--accent-primary-hover)]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reload & Update
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss update banner"
          className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
