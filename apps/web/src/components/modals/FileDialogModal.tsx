import React, { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { FileCode2, Folder, FolderUp, Save, X } from 'lucide-react';

export interface FileEntryItem {
  name: string;
  isDirectory: boolean;
}

export interface FileDialogModalProps {
  open: boolean;
  mode: 'open' | 'save-as';
  initialDir: string;
  initialFilename?: string;
  onOpenChange: (open: boolean) => void;
  listDir: (dir: string) => Promise<FileEntryItem[]>;
  onSelectOpen: (fullPath: string) => void;
  onSelectSave: (fullPath: string) => void;
}

export const FileDialogModal: React.FC<FileDialogModalProps> = ({
  open,
  mode,
  initialDir,
  initialFilename = 'program.ngc',
  onOpenChange,
  listDir,
  onSelectOpen,
  onSelectSave,
}) => {
  const [dir, setDir] = useState(initialDir);
  const [entries, setEntries] = useState<FileEntryItem[]>([]);
  const [filename, setFilename] = useState(initialFilename);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listDirRef = useRef(listDir);
  listDirRef.current = listDir;

  useEffect(() => {
    if (!open) return;
    setDir(initialDir);
    setFilename(initialFilename);
  }, [open, initialDir, initialFilename]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listDirRef
      .current(dir)
      .then((items) => {
        if (!cancelled) setEntries(items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, dir]);

  const joinPath = (base: string, name: string) => {
    const cleanBase = base.replace(/\/+$/, '');
    return cleanBase ? `${cleanBase}/${name}` : name;
  };

  const goUp = () => {
    const parts = dir.replace(/\/+$/, '').split('/').filter(Boolean);
    parts.pop();
    setDir(parts.length ? parts.join('/') : '.');
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!filename.trim()) return;
    const full = joinPath(dir, filename.trim());
    if (mode === 'open') {
      onSelectOpen(full);
    } else {
      onSelectSave(full);
    }
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-[min(94vw,520px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-[var(--border-strong)] bg-[var(--bg-panel)] p-4 shadow-2xl focus:outline-none">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
            <Dialog.Title className="text-sm font-bold text-[var(--text-primary)]">
              {mode === 'open' ? 'Open File from Machine Root' : 'Save File As'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={goUp} className="btn-workshop !min-h-7 !px-2 !text-xs">
              <FolderUp className="h-3.5 w-3.5" />
              Up
            </button>
            <div className="flex-1 truncate rounded border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2.5 py-1 font-mono-tabular text-xs text-[var(--text-secondary)]">
              /{dir}
            </div>
          </div>

          <div className="mt-2 min-h-[200px] flex-1 overflow-y-auto rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
            {loading && (
              <div className="p-4 text-center text-xs text-[var(--text-muted)]">Loading…</div>
            )}
            {error && <div className="p-3 text-xs text-[var(--accent-red)]">{error}</div>}
            {!loading && !error && entries.length === 0 && (
              <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                Directory is empty
              </div>
            )}
            {!loading &&
              entries.map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  onClick={() => {
                    if (entry.isDirectory) {
                      setDir(joinPath(dir, entry.name));
                    } else {
                      setFilename(entry.name);
                    }
                  }}
                  onDoubleClick={() => {
                    if (!entry.isDirectory && mode === 'open') {
                      onSelectOpen(joinPath(dir, entry.name));
                      onOpenChange(false);
                    }
                  }}
                  className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs transition ${
                    !entry.isDirectory && filename === entry.name
                      ? 'bg-[var(--accent-primary)]/20 text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {entry.isDirectory ? (
                    <Folder className="h-4 w-4 shrink-0 text-[var(--accent-amber)]" />
                  ) : (
                    <FileCode2 className="h-4 w-4 shrink-0 text-[var(--accent-cyan)]" />
                  )}
                  <span className="truncate font-mono-tabular">{entry.name}</span>
                </button>
              ))}
          </div>

          <form onSubmit={handleConfirm} className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="filename.ngc"
              className="flex-1 rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-1.5 font-mono-tabular text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
            <button
              type="submit"
              className="btn-workshop !bg-[var(--accent-primary)] !text-slate-950 !border-transparent"
            >
              {mode === 'save-as' && <Save className="h-3.5 w-3.5" />}
              {mode === 'open' ? 'Open' : 'Save'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
