import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = path => readFileSync(new URL(`../src/app/${path}`, import.meta.url), 'utf8');
function load(sourceText, dependencies = {}) {
  const exports = {};
  const compiled = ts.transpileModule(sourceText, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      experimentalDecorators: true
    }
  }).outputText;
  vm.runInNewContext(compiled, { exports, require: name => dependencies[name] });
  return exports;
}
const { FileResource } = load(source('resources/file-resource.ts'));
const decorator = () => () => {};
const { AceEditorComponent } = load(source('editor/ace-editor.component.ts'), {
  '@angular/core': {
    Component: decorator, Inject: decorator, Input: decorator,
    ViewChild: decorator, ViewEncapsulation: { None: 0 }
  },
  './ace.directive': { AceDirective: class {} },
  '../resources': { FileResource, FileDialogComponent: class {}, FileStoreToken: {} }
});

test('editor input supplies the initial directory before the dialog is created', () => {
  for (const directory of ['./gcode', './c-programs']) {
    const editor = new AceEditorComponent({ textSubject: { subscribe() {} } });
    editor.defaultDirectory = directory;
    assert.equal(editor.resource.dir, directory);
    assert.equal(editor.resource.file, '');
    // A selected file must not be replaced by another default input update.
    editor.resource = new FileResource('./gcode', 'selected.ngc');
    editor.defaultDirectory = directory;
    assert.equal(editor.resource.canonical, './gcode/selected.ngc');
  }
});

test('both editor hosts declare their defaults in the template, not AfterViewInit', () => {
  for (const [path, directory] of [
    ['gcode/gcode-editor.component.ts', './gcode'],
    ['ccode/ccode-editor.component.ts', './c-programs']
  ]) {
    const text = source(path);
    assert.ok(text.includes(`defaultDirectory="${directory}"`));
    assert.ok(!text.includes(`onFile(new FileResource('${directory}'))`));
  }
});
