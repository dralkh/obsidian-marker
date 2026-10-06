// Optional real-account check. Uses installed CLI accounts and their configured models.
import { build } from 'esbuild';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const root = await mkdtemp(join(tmpdir(), 'marker-cli-smoke-'));
const require = createRequire(import.meta.url);
try {
  const bundle = join(root, 'cli.cjs');
  await build({ entryPoints: ['tests/entry.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: bundle,
    plugins: [{ name: 'obsidian-test-double', setup(builder) {
      builder.onResolve({ filter: /^obsidian$/ }, () => ({ path: join(process.cwd(), 'tests/obsidian.cjs') }));
    } }],
  });
  const cli = require(bundle);
  const detector = new cli.CliDetector();
  const requested = process.argv.slice(2);
  const installations = (await detector.detectAll()).filter(installation => !requested.length || requested.includes(installation.provider));
  for (const installation of installations) console.log(`${installation.provider}: ${installation.status}${installation.path ? ` (${installation.path})` : ''}`);
  const results = await Promise.all(installations.map(async installation => {
    if (installation.status !== 'ready') return { provider: installation.provider, result: 'unavailable' };
    const work = await mkdtemp(join(root, installation.provider + '-'));
    const source = '# Demo\n\n### Details\n\n- Date: 2026-10-06\n- Quantity: 42\n- Reference: [Source](https://example.org/source)\n';
    const id = 'smoke-' + installation.provider;
    await writeFile(join(work, 'document.md'), source);
    await writeFile(join(work, 'prompt.txt'), cli.buildJobPrompt(cli.DEFAULT_FORMAT_PROMPT, id));
    // The pipeline also creates Cursor workspace permissions; use the same restriction here.
    if (installation.provider === 'cursor') {
      const { mkdir } = await import('node:fs/promises'); await mkdir(join(work, '.cursor'));
      await writeFile(join(work, '.cursor', 'cli.json'), JSON.stringify({ permissions: {
        allow: ['Read(*)', 'Write(document.md)', 'Write(backup.md)', 'Write(.format-result.json)'],
        deny: ['Shell(*)', 'WebFetch(*)', 'Mcp(*:*)', 'Write(.cursor/**)'],
      } }));
    }
    let model = 'CLI default';
    try {
      const limit = Number(process.env.MARKER_CLI_SMOKE_MINUTES || '1.5');
      await cli.runCli(installation, work, await detector.getEnvironment(), new AbortController().signal, limit, value => { model = value; });
      const result = JSON.parse(await readFile(join(work, '.format-result.json'), 'utf8'));
      if (result.jobId !== id || result.completed !== true || result.reviewed !== true) throw new Error('Completion report missing or invalid');
      cli.validateFormatted(source, await readFile(join(work, 'document.md'), 'utf8'));
      const output = { provider: installation.provider, result: 'passed', model };
      console.log(JSON.stringify(output)); return output;
    } catch (error) {
      const output = { provider: installation.provider, result: 'failed', reason: error.code === 'ENOENT' ? 'No completion report' : error.message, model };
      console.log(JSON.stringify(output)); return output;
    }
  }));
  if (results.some(result => result.result === 'failed')) process.exitCode = 1;
} finally { await rm(root, { recursive: true, force: true }); }
