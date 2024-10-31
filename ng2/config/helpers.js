import path from 'path';

const _root = path.resolve(new URL('.', import.meta.url).pathname, '..');

export function root(...args) {
    const resolved = path.join(_root, ...args);
    console.log(resolved);
    return resolved;
}