import React, { useState } from 'react';
import { FileCode2, FolderOpen, Save, SaveAll, Upload } from 'lucide-react';
import { CodeMirrorEditor } from '../editor/CodeMirrorEditor';

export interface GcodeEditorPanelProps {
  filename: string;
  text: string;
  dirty: boolean;
  activeExecLine: number | null;
  selectedLine: number | null;
  theme: 'dark' | 'light';
  readOnly?: boolean;
  onChangeText: (text: string) => void;
  onCursorLineChange?: (line: number) => void;
  onOpenDialog: () => void;
  onSave: () => void;
  onSaveAsDialog: () => void;
  onDropLocalFile: (filename: string, content: string) => void;
}

export const GcodeEditorPanel: React.FC<GcodeEditorPanelProps> = ({
  filename,
  text,
  dirty,
  activeExecLine,
  selectedLine,
  theme,
  readOnly = false,
  onChangeText,
  onCursorLineChange,
  onOpenDialog,
  onSave,
  onSaveAsDialog,
  onDropLocalFile,
}) => {
  const [dragging, setDragging] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const content = await file.text();
    onDropLocalFile(file.name, content);
  };

  return (
    <div
      className="relative flex h-full flex-col bg-[var(--bg-panel)]"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <FileCode2 className="h-3.5 w-3.5 shrink-0 text-[var(--accent-cyan)]" />
          <span className="truncate font-mono-tabular text-xs font-semibold text-[var(--text-primary)]">
            {filename || 'untitled.ngc'}
          </span>
          {dirty && (
            <span
              title="Unsaved changes"
              className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent-amber)]"
            />
          )}
          {activeExecLine != null && activeExecLine > 0 && (
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold text-emerald-400">
              EXEC L{activeExecLine}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenDialog}
            title="Open G-code file"
            className="btn-workshop !min-h-6 !px-2 !text-[11px]"
          >
            <FolderOpen className="h-3 w-3" />
            Open
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty}
            title="Save G-code file"
            className="btn-workshop !min-h-6 !px-2 !text-[11px]"
          >
            <Save className="h-3 w-3" />
            Save
          </button>
          <button
            type="button"
            onClick={onSaveAsDialog}
            title="Save As..."
            className="btn-workshop !min-h-6 !px-2 !text-[11px]"
          >
            <SaveAll className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="min-h-0 flex-1">
        <CodeMirrorEditor
          value={text}
          onChange={onChangeText}
          language="gcode"
          theme={theme}
          readOnly={readOnly}
          activeExecLine={activeExecLine}
          selectedLine={selectedLine}
          onCursorLineChange={onCursorLineChange}
        />
      </div>

      {/* Drag Overlay */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[var(--accent-primary)] bg-[var(--bg-app)]/85 backdrop-blur-xs">
          <Upload className="h-8 w-8 text-[var(--accent-primary)]" />
          <span className="text-sm font-bold text-[var(--text-primary)]">
            Drop G-code file to load
          </span>
        </div>
      )}
    </div>
  );
};
