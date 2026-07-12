import path from 'path';
import { fileURLToPath } from 'url';

/** Directory of the current main-process module (works in dev, CJS, and packaged ESM). */
export const mainDirname = (() => {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  return path.dirname(fileURLToPath(import.meta.url));
})();
