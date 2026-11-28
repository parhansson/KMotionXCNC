import React, { useEffect, useRef, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Trash2 } from 'lucide-react';

export interface LogMessageItem {
  timestamp: number;
  message: string;
  direction?: 'in' | 'out' | 'info' | 'error';
}

export interface LogsPanelProps {
  consoleLogs: LogMessageItem[];
  errorLogs: LogMessageItem[];
  statusLogs: LogMessageItem[];
  rawLogs: LogMessageItem[];
  onClear?: (channel: 'console' | 'error' | 'status' | 'raw') => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8);
}

export const LogsPanel: React.FC<LogsPanelProps> = ({
  consoleLogs,
  errorLogs,
  statusLogs,
  rawLogs,
  onClear,
}) => {
  const [tab, setTab] = useState<'console' | 'error' | 'status' | 'raw'>('console');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const activeLogs =
    tab === 'console'
      ? consoleLogs
      : tab === 'error'
        ? errorLogs
        : tab === 'status'
          ? statusLogs
          : rawLogs;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeLogs.length, tab]);

  return (
    <Tabs.Root
      value={tab}
      onValueChange={(v) => setTab(v as typeof tab)}
      className="flex h-full flex-col bg-[var(--bg-panel)]"
    >
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2">
        <Tabs.List className="flex items-center gap-1">
          {(
            [
              { id: 'console', label: 'Console', count: consoleLogs.length },
              { id: 'error', label: 'Errors', count: errorLogs.length },
              { id: 'status', label: 'Status', count: statusLogs.length },
              { id: 'raw', label: 'Raw Comm', count: rawLogs.length },
            ] as const
          ).map((item) => (
            <Tabs.Trigger
              key={item.id}
              value={item.id}
              className="flex items-center gap-1.5 border-b-2 border-transparent px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] transition data-[state=active]:border-[var(--accent-primary)] data-[state=active]:text-[var(--text-primary)]"
            >
              <span>{item.label}</span>
              {item.count > 0 && (
                <span
                  className={`rounded-full px-1.5 text-[10px] ${
                    item.id === 'error'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {onClear && (
          <button
            type="button"
            onClick={() => onClear(tab)}
            title={`Clear ${tab} logs`}
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-[var(--bg-input)] p-2 font-mono-tabular text-xs"
      >
        {activeLogs.length === 0 ? (
          <div className="py-4 text-center text-[var(--text-muted)]">No {tab} entries yet.</div>
        ) : (
          activeLogs.map((entry, idx) => {
            const color =
              tab === 'error' || entry.direction === 'error'
                ? 'text-red-400'
                : entry.direction === 'in'
                  ? 'text-cyan-400'
                  : entry.direction === 'out'
                    ? 'text-amber-400'
                    : 'text-[var(--text-primary)]';
            return (
              <div key={idx} className="flex gap-2 border-b border-[var(--border-subtle)]/40 py-0.5">
                <span className="shrink-0 text-[var(--text-muted)]">
                  [{formatTime(entry.timestamp)}]
                </span>
                {entry.direction && (
                  <span className="shrink-0 uppercase text-[10px] font-bold text-[var(--text-muted)]">
                    {entry.direction}
                  </span>
                )}
                <span className={`break-all ${color}`}>{entry.message}</span>
              </div>
            );
          })
        )}
      </div>
    </Tabs.Root>
  );
};
