import React, { useEffect, useRef } from 'react';
import { EditorState, StateEffect, StateField, Compartment, type Extension } from '@codemirror/state';
import {
  EditorView,
  Decoration,
  type DecorationSet,
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
  keymap,
  drawSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { cpp } from '@codemirror/lang-cpp';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { gcodeLanguageExtension } from './gcode-language';

const setHighlightLinesEffect = StateEffect.define<{
  activeExecLine: number | null;
  selectedLine: number | null;
}>();

const highlightLinesField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    let next = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setHighlightLinesEffect)) {
        const items: { from: number; deco: Decoration }[] = [];
        const { activeExecLine, selectedLine } = effect.value;
        const doc = tr.state.doc;

        if (activeExecLine != null && activeExecLine >= 1 && activeExecLine <= doc.lines) {
          const line = doc.line(activeExecLine);
          items.push({
            from: line.from,
            deco: Decoration.line({ attributes: { class: 'cm-active-exec-line' } }),
          });
        }
        if (selectedLine != null && selectedLine >= 1 && selectedLine <= doc.lines && selectedLine !== activeExecLine) {
          const line = doc.line(selectedLine);
          items.push({
            from: line.from,
            deco: Decoration.line({ attributes: { class: 'cm-selected-3d-line' } }),
          });
        }
        items.sort((a, b) => a.from - b.from);
        next = Decoration.set(items.map((i) => i.deco.range(i.from)));
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function buildEditorTheme(theme: 'dark' | 'light'): Extension {
  const isDark = theme === 'dark';
  return EditorView.theme(
    {
      '&': {
        backgroundColor: isDark ? '#0e141c' : '#f8fafc',
        color: isDark ? '#e2e8f0' : '#0f172a',
        height: '100%',
      },
      '.cm-content': {
        caretColor: '#f59e0b',
      },
      '.cm-gutters': {
        backgroundColor: isDark ? '#121821' : '#eef2f7',
        color: isDark ? '#64748b' : '#64748b',
        borderRight: isDark ? '1px solid #222e3e' : '1px solid #d8e0ea',
      },
      '.cm-activeLineGutter': {
        backgroundColor: isDark ? '#1d2736' : '#e2e8f0',
        color: isDark ? '#f8fafc' : '#0f172a',
      },
      '.cm-activeLine': {
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
      },
      '&.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: isDark ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.3)',
      },
    },
    { dark: isDark },
  );
}

export interface CodeMirrorEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: 'gcode' | 'cpp';
  theme: 'dark' | 'light';
  readOnly?: boolean;
  /** 1-based line number currently executing */
  activeExecLine?: number | null;
  /** 1-based line number selected (e.g. from 3D toolpath click) */
  selectedLine?: number | null;
  /** Emitted when user clicks/moves cursor to a 1-based line */
  onCursorLineChange?: (line: number) => void;
  className?: string;
}

export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  value,
  onChange,
  language,
  theme,
  readOnly = false,
  activeExecLine = null,
  selectedLine = null,
  onCursorLineChange,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartment = useRef(new Compartment());
  const langCompartment = useRef(new Compartment());
  const readOnlyCompartment = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const onCursorLineRef = useRef(onCursorLineChange);
  const isInternalChange = useRef(false);

  onChangeRef.current = onChange;
  onCursorLineRef.current = onCursorLineChange;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const langExt =
      language === 'gcode'
        ? gcodeLanguageExtension(theme)
        : [cpp(), syntaxHighlighting(defaultHighlightStyle)];

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        highlightSelectionMatches(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        highlightLinesField,
        themeCompartment.current.of(buildEditorTheme(theme)),
        langCompartment.current.of(langExt),
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isInternalChange.current) {
            onChangeRef.current?.(update.state.doc.toString());
          }
          if (update.selectionSet) {
            const pos = update.state.selection.main.head;
            const lineNum = update.state.doc.lineAt(pos).number;
            onCursorLineRef.current?.(lineNum);
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: el });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external document updates
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      isInternalChange.current = true;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
      isInternalChange.current = false;
    }
  }, [value]);

  // Sync theme & language
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const langExt =
      language === 'gcode'
        ? gcodeLanguageExtension(theme)
        : [cpp(), syntaxHighlighting(defaultHighlightStyle)];
    view.dispatch({
      effects: [
        themeCompartment.current.reconfigure(buildEditorTheme(theme)),
        langCompartment.current.reconfigure(langExt),
      ],
    });
  }, [theme, language]);

  // Sync readOnly
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartment.current.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  // Sync activeExecLine & selectedLine + scroll into view
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const targetLine = selectedLine ?? activeExecLine;
    const effects: StateEffect<unknown>[] = [
      setHighlightLinesEffect.of({ activeExecLine, selectedLine }),
    ];

    if (targetLine != null && targetLine >= 1 && targetLine <= view.state.doc.lines) {
      const lineInfo = view.state.doc.line(targetLine);
      effects.push(EditorView.scrollIntoView(lineInfo.from, { y: 'center' }));
    }

    view.dispatch({ effects });
  }, [activeExecLine, selectedLine]);

  return <div ref={containerRef} className={`h-full w-full overflow-hidden ${className}`} />;
};
