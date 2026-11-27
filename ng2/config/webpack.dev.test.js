import assert from 'node:assert/strict';
import { test } from 'node:test';
import config from './webpack.dev.js';

test('all development proxies use the backend IPv4 loopback listener', () => {
  assert.equal(config.devServer.proxy.length, 3);
  for (const proxy of config.devServer.proxy) {
    assert.equal(proxy.target, 'http://127.0.0.1:8080');
  }
  assert.ok(config.devServer.proxy.some(proxy => proxy.ws && proxy.context.includes('/ws')));
  assert.ok(config.devServer.proxy.some(proxy => proxy.context.includes('/api/**')));
  assert.ok(config.devServer.proxy.some(proxy => proxy.context.includes('/upload')));
});
