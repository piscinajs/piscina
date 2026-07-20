import { resolve } from 'node:path';
import Piscina from '../../dist';

jest.setTimeout(5000);

describe('Piscina ready message detection', () => {
  let pool: Piscina | null = null;

  afterEach(async () => {
    if (pool) {
      await pool.destroy();
      pool = null;
    }
  });

  it('should detect worker ready message with minThreads=0', async () => {
    pool = new Piscina({
      filename: resolve(__dirname, '../fixtures/eval.js'),
      minThreads: 0,
      maxThreads: 1
    });

    expect(pool.threads.length).toBe(0);

    const result = await pool.run('42');

    expect(result).toBe(42);
    expect(pool.threads.length).toBe(1);
  });
});
