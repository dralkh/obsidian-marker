import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const directory = await mkdtemp(join(tmpdir(), 'marker-test-build-'));
try {
  const bundle = join(directory, 'cli.cjs');
  await build({ entryPoints: ['tests/entry.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: bundle,
    plugins: [{ name: 'obsidian-test-double', setup(builder) {
      builder.onResolve({ filter: /^obsidian$/ }, () => ({ path: join(process.cwd(), 'tests/obsidian.cjs') }));
    } }],
  });
  const child = spawn(process.execPath, ['--test', 'tests/cli.test.cjs'], {
    stdio: 'inherit', env: { ...process.env, MARKER_TEST_BUNDLE: bundle },
  });
  process.exitCode = await new Promise(resolve => child.on('exit', code => resolve(code || 0)));
} finally { await rm(directory, { recursive: true, force: true }); }
