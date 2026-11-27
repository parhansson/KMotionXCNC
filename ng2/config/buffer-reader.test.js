import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/app/util/buffer-reader.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText, { exports, TextDecoder });
const { BufferReader } = exports;

for (const text of ['', 'gcode/example.ngc', 'gcode/fräs-🛠.ngc']) {
  test(`status string preserves byte boundaries: ${JSON.stringify(text)}`, () => {
    const bytes = new TextEncoder().encode(text);
    const buffer = new ArrayBuffer(4 + bytes.length + 4);
    const view = new DataView(buffer);
    view.setUint32(0, bytes.length, true);
    new Uint8Array(buffer, 4, bytes.length).set(bytes);
    view.setUint32(4 + bytes.length, 12345, true);
    const reader = new BufferReader(buffer);
    assert.equal(reader.string(), text);
    assert.equal(reader.int(), 12345);
    assert.equal(reader.off, buffer.byteLength);
  });
}

test('rejects a truncated status string', () => {
  const buffer = new ArrayBuffer(5);
  new DataView(buffer).setUint32(0, 2, true);
  assert.throws(() => new BufferReader(buffer).string(), /Truncated status string/);
});
