import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';

test('resourceLimits causes task to reject', async ({ equal, rejects }) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/resource-limits.js'),
    resourceLimits: {
      maxOldGenerationSizeMb: 16,
      maxYoungGenerationSizeMb: 4,
      codeRangeSizeMb: 16
    }
  });
  worker.on('error', () => {
    // Ignore any additional errors that may occur.
    // This may happen because when the Worker is
    // killed a new worker is created that may hit
    // the memory limits immediately. When that
    // happens, there is no associated Promise to
    // reject so we emit an error event instead.
    // We don't care so much about that here. We
    // could potentially avoid the issue by setting
    // higher limits above but rather than try to
    // guess at limits that may work consistently,
    // let's just ignore the additional error for
    // now.
  });
  const limits : any = worker.options.resourceLimits;
  equal(limits.maxOldGenerationSizeMb, 16);
  equal(limits.maxYoungGenerationSizeMb, 4);
  equal(limits.codeRangeSizeMb, 16);
  rejects(worker.runTask(null),
    /Worker terminated due to reaching memory limit: JS heap out of memory/);
});
