// These tests are skipped in this fork because we've modified how the package
// is built and the tests are checking for an esm from cjs wrapper that the
// original package builds

import { test } from 'tap';

const importESM : (specifier : string) => Promise<any> =
  // eslint-disable-next-line no-eval
  eval('(specifier) => import(specifier)');

test('Piscina is default export', {skip: true}, async ({ equal }) => {
  equal((await importESM('piscina')).default, require('../'));
});

test('Exports match own property names', {skip: true}, async ({ strictSame }) => {
  // Check that version, workerData, etc. are re-exported.
  const exported = new Set(Object.getOwnPropertyNames(await importESM('piscina')));
  const required = new Set(Object.getOwnPropertyNames(require('../')));

  // Remove constructor properties + default export.
  for (const k of ['prototype', 'length', 'name']) required.delete(k);
  exported.delete('default');

  strictSame(exported, required);
});
