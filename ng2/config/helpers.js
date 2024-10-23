const path = require('path');
const _root = path.resolve(__dirname, '..');
function root(args) {
  args = Array.prototype.slice.call(arguments, 0);
  const resolved = path.join.apply(path, [_root].concat(args));
  console.log(resolved)
  return resolved
}
exports.root = root;
