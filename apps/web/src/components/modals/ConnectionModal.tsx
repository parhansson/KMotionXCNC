import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CheckCircle2, Cpu, Globe, KeyRound, Radio, Server, Wifi, X } from 'lucide-react';

export type ConnectionMode = 'simulator' | 'same-origin' | 'custom-lan';

export interface ConnectionSettings {
  mode: ConnectionMode;
  baseUrl: string;
  authToken: string;
}

export interface CapabilitiesSummary {
  apiVersion?: number;
  offline?: boolean;
  maxAxes?: number;
  jogHeartbeatMs?: number;
  features?: Record<string, boolean | undefined>;
}

export interface ConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ConnectionSettings;
  connectionStatus: string;
  capabilities: CapabilitiesSummary | null;
  onApply: (settings: ConnectionSettings) => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  open,
  onOpenChange,
  settings,
  connectionStatus,
  capabilities,
  onApply,
}) => {
  const [mode, setMode] = useState<ConnectionMode>(settings.mode);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl || 'https://cnc-machine.local:8443');
  const [authToken, setAuthToken] = useState(settings.authToken);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    onApply({
      mode,
      baseUrl: mode === 'custom-lan' ? baseUrl.trim().replace(/\/+$/, '') : '',
      authToken: authToken.trim(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(94vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-panel)] p-5 shadow-2xl focus:outline-none">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
            <Dialog.Title className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
              <Radio className="h-4 w-4 text-[var(--accent-primary)]" />
              Backend Connection &amp; Capabilities
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleConnect} className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'simulator', label: 'Simulator', desc: 'Built-in Mock', icon: Cpu },
                  { id: 'same-origin', label: 'Local Origin', desc: 'kmxWeb local', icon: Server },
                  { id: 'custom-lan', label: 'Custom LAN', desc: 'HTTPS / WSS', icon: Globe },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                const active = mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMode(opt.id)}
                    className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left transition ${
                      active
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                        : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? 'text-[var(--accent-primary)]' : ''}`} />
                    <span className="text-xs font-bold">{opt.label}</span>
                    <span className="text-[11px] text-[var(--text-muted)]">{opt.desc}</span>
                  </button>
                );
              })}
            </div>

            {mode === 'custom-lan' && (
              <div className="space-y-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                    Backend Base URL (HTTPS recommended for PWA)
                  </label>
                  <div className="relative">
                    <Wifi className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
                    <input
                      type="url"
                      required
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="https://cnc-box.local:8443"
                      className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] py-2 pl-8 pr-3 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                    Auth / Pairing Token (optional)
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
                    <input
                      type="password"
                      value={authToken}
                      onChange={(e) => setAuthToken(e.target.value)}
                      placeholder="Bearer token stored locally in browser"
                      className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] py-2 pl-8 pr-3 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--text-secondary)]">Current Status</span>
                <span className="font-mono-tabular font-semibold uppercase text-[var(--accent-cyan)]">
                  {connectionStatus}
                </span>
              </div>
              {capabilities && (
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-[var(--border-subtle)] pt-2 text-[11px] text-[var(--text-secondary)]">
                  <span>API Version: v{capabilities.apiVersion ?? 1}</span>
                  <span>Max Axes: {capabilities.maxAxes ?? 8}</span>
                  <span>Offline Mode: {capabilities.offline ? 'Yes' : 'No'}</span>
                  <span>Jog Heartbeat: {capabilities.jogHeartbeatMs ?? 500}ms</span>
                  {capabilities.features && (
                    <div className="col-span-2 mt-1 flex flex-wrap gap-1.5">
                      {Object.entries(capabilities.features).map(([key, enabled]) => (
                        <span
                          key={key}
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            enabled
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-slate-500/15 text-slate-400'
                          }`}
                        >
                          {enabled && <CheckCircle2 className="h-2.5 w-2.5" />}
                          {key}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Dialog.Close asChild>
                <button type="button" className="btn-workshop">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="btn-workshop !bg-[var(--accent-primary)] !text-slate-950 !border-transparent hover:!bg-[var(--accent-primary-hover)]"
              >
                Connect
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
