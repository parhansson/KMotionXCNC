import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

/**
 * Lightweight G-code tokenizer for CodeMirror 6.
 * Highlights G-codes, M-codes, axis words (X-V, I-K, R), feeds/speeds (F, S, P, Q, T),
 * line numbers (N), and comments (parenthetical or semicolon).
 */
const gcodeStream = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null;

    // Semicolon comment to end of line
    if (stream.peek() === ';') {
      stream.skipToEnd();
      return 'comment';
    }

    // Parenthetical comment (...)
    if (stream.peek() === '(') {
      stream.next();
      while (!stream.eol()) {
        if (stream.next() === ')') break;
      }
      return 'comment';
    }

    // Block delete / program delimiter
    if (stream.peek() === '/' || stream.peek() === '%') {
      stream.next();
      return 'meta';
    }

    // G-codes
    if (stream.match(/^[Gg]\d+(\.\d+)?/)) {
      return 'keyword';
    }

    // M-codes
    if (stream.match(/^[Mm]\d+(\.\d+)?/)) {
      return 'atom';
    }

    // Line numbers
    if (stream.match(/^[Nn]\d+/)) {
      return 'meta';
    }

    // Axis words (X Y Z A B C U V I J K R)
    if (stream.match(/^[XxYyZzAaBbCcUuVvIiJjKkRr][-+]?(\d+\.?\d*|\.\d+)/)) {
      return 'variableName';
    }

    // Feed, Speed, Tool, Dwell, Parameters (F S T P Q H D L)
    if (stream.match(/^[FfSsTtPpQqHhDdLl][-+]?(\d+\.?\d*|\.\d+)/)) {
      return 'number';
    }

    // Standalone numbers
    if (stream.match(/^[-+]?(\d+\.?\d*|\.\d+)/)) {
      return 'number';
    }

    stream.next();
    return null;
  },
});

const darkGcodeHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#38bdf8', fontWeight: '700' },     // G-codes: sky cyan
  { tag: tags.atom, color: '#f59e0b', fontWeight: '700' },        // M-codes: amber
  { tag: tags.variableName, color: '#34d399' },                   // Axes: emerald
  { tag: tags.number, color: '#c084fc' },                         // F/S/T/P: purple
  { tag: tags.comment, color: '#64748b', fontStyle: 'italic' },   // Comments: muted slate
  { tag: tags.meta, color: '#94a3b8' },                           // N-lines / %
]);

const lightGcodeHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#0369a1', fontWeight: '700' },
  { tag: tags.atom, color: '#b45309', fontWeight: '700' },
  { tag: tags.variableName, color: '#047857' },
  { tag: tags.number, color: '#7e22ce' },
  { tag: tags.comment, color: '#64748b', fontStyle: 'italic' },
  { tag: tags.meta, color: '#475569' },
]);

export function gcodeLanguageExtension(theme: 'dark' | 'light'): Extension {
  return [
    gcodeStream,
    syntaxHighlighting(theme === 'dark' ? darkGcodeHighlight : lightGcodeHighlight),
  ];
}
