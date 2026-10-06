const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const cli = require(process.env.MARKER_TEST_BUNDLE);
const fixture = path.resolve('tests/fake-cli.cjs');
const formatting = { cliFormattingEnabled: true, cliProvider: 'codex', cliPromptOverride: null, cliTimeoutMinutes: 0 };

function prepared(text = '# Demo\n\nDate: 2026-10-06. Value: 42.\n![Image](assets/demo.png)\n') {
  return { folderPath: 'Demo/', originalPath: 'Demo.pdf', originalName: 'Demo.pdf', markdownPath: 'Demo/Demo.md',
    files: { 'Demo/assets/demo.png': { binary: true, content: Buffer.from('image').toString('base64') },
      'Demo/Demo.md': { binary: false, content: text } }, moveOriginal: true, deleteOriginal: true };
}
function memoryStore() {
  const files = new Map(); const writes = [];
  return { files, writes,
    async read(key) { return files.get(key) || null; },
    async write(key, value) { files.set(key, { ...value }); writes.push(key); },
    async remove(key) { files.delete(key); },
  };
}
function fakeDetector(provider = 'codex', env = {}) {
  return { async detect() { return { provider, executable: process.execPath, prefix: [fixture], status: 'ready', help: '--trust --no-session-persistence' }; },
    async getEnvironment() { return { ...process.env, ...env }; } };
}
async function setup(t, options = {}) {
  const store = options.store || memoryStore(); const notices = []; const completed = [];
  const identity = options.identity || crypto.randomBytes(20).toString('hex');
  const root = path.join(os.tmpdir(), 'obsidian-marker-' + crypto.createHash('sha256').update(identity).digest('hex').slice(0, 24));
  const host = { store, async confirmOverwrite() { return true; }, async complete(...args) { completed.push(args); },
    progress() {}, notify(message) { notices.push(message); } };
  const pipeline = new cli.FormattingPipeline(host, options.desktop !== false, identity, options.detector || fakeDetector(), options.runner);
  t.after(async () => { pipeline.dispose(); await fs.rm(root, { recursive: true, force: true }); });
  return { pipeline, store, notices, completed, root, identity, host };
}
function reportFromPrompt(prompt) { return JSON.parse(prompt.match(/\{"jobId":"[^"\n]+","completed":true,"reviewed":true\}/)[0]); }
async function fakeComplete(_installation, work) {
  const prompt = await fs.readFile(path.join(work, 'prompt.txt'), 'utf8');
  await fs.writeFile(path.join(work, '.format-result.json'), JSON.stringify(reportFromPrompt(prompt)));
  const doc = await fs.readFile(path.join(work, 'document.md'), 'utf8');
  await fs.writeFile(path.join(work, 'document.md'), doc.replace('# Demo', '# Demo\n'));
}

test('agent identities are verified and editor/unrelated launchers are rejected', () => {
  assert.equal(cli.supportsProvider('cursor', 'Usage: agent --print --force --output-format'), false);
  assert.equal(cli.supportsProvider('antigravity', 'Antigravity editor --help --open'), false);
  assert.equal(cli.supportsProvider('codex', 'Codex --json'), false);
  assert.equal(cli.supportsProvider('hermes', 'Hermes --query-file --oneshot --format'), true);
});
test('mobile plugin initialization does not load desktop filesystem or subprocess modules', async () => {
  const plugin = new cli.MarkerPlugin();
  plugin.app = { vault: { adapter: {}, getName() { return 'Mobile'; } }, workspace: { on() { return {}; } } };
  const Module = require('node:module'); const load = Module._load;
  Module._load = function(name, ...args) {
    if (['fs', 'os', 'path', 'crypto', 'child_process'].includes(name)) throw new Error('Unexpected desktop module: ' + name);
    return load.call(this, name, ...args);
  };
  try {
    await plugin.onload();
    assert.equal(plugin.isDesktop, false); assert.equal(plugin.settings.cliFormattingEnabled, false);
    await plugin.onunload();
  } finally { Module._load = load; }
});
test('source handling occurs once after publication and skips changed or recovered originals', async () => {
  const plugin = new cli.MarkerPlugin(); let moves = 0; let deletes = 0; let opens = 0;
  const source = new cli.TestTFile('Demo.pdf');
  plugin.app = { vault: {
    getAbstractFileByPath() { return source; }, async rename() { moves++; },
  }, fileManager: { async trashFile() { deletes++; } }, workspace: { async openLinkText() { opens++; } } };
  const original = prepared(); original.sourceMtime = 1; original.sourceSize = 10;
  await plugin.completeConversion(original, 'formatted', false, new AbortController().signal);
  assert.equal(moves, 1); assert.equal(deletes, 1); assert.equal(opens, 1);
  source.stat.mtime = 2;
  await plugin.completeConversion(original, 'formatted', false, new AbortController().signal);
  await plugin.completeConversion(original, 'formatted', true, new AbortController().signal);
  assert.equal(moves, 1); assert.equal(deletes, 1);
  const controller = new AbortController(); controller.abort();
  await plugin.completeConversion(original, 'formatted', false, controller.signal);
  assert.equal(opens, 3);
});
test('all five converters use the shared pipeline and propagate its publication outcome', async () => {
  const settings = { extractContent: 'all', createAssetSubfolder: true, ...formatting };
  for (const Converter of [cli.DatalabConverter, cli.MarkerApiDockerConverter, cli.PythonLocalAPIConverter, cli.PythonCloudAPIConverter, cli.MistralAIConverter]) {
    let calls = 0;
    const pipeline = { async process(request) {
      calls++; assert.equal(request.formatting.cliProvider, 'codex');
      assert.equal(request.prepared.markdownPath, 'Demo/Demo.md'); return calls === 1 ? 'formatted' : 'failed';
    } };
    const converter = new Converter(pipeline);
    const file = new cli.TestTFile('Demo.pdf');
    const data = { success: true, markdown: '# Demo' };
    assert.equal(await converter.processConversionResult(settings, data, 'Demo/', file), true);
    assert.equal(await converter.processConversionResult(settings, data, 'Demo/', file), false);
    assert.equal(calls, 2);
  }
});
test('Obsidian vault publication creates nested folders and preserves binary image bytes', async () => {
  const entries = new Map(); const content = new Map();
  const vault = {
    adapter: { async exists(key) { return entries.has(key); } },
    getAbstractFileByPath(key) { return entries.get(key); },
    async createFolder(key) { entries.set(key, new cli.TestTFolder()); },
    async createBinary(key, value) { entries.set(key, new cli.TestTFile(key)); content.set(key, value); },
    async create(key, value) { entries.set(key, new cli.TestTFile(key)); content.set(key, value); },
    async readBinary(file) { return content.get(file.path); },
    async read(file) { return content.get(file.path); },
    async modifyBinary(file, value) { content.set(file.path, value); },
    async modify(file, value) { content.set(file.path, value); },
    async delete(file) { entries.delete(file.path); content.delete(file.path); },
  };
  const store = cli.vaultOutputStore({ vault });
  await store.write('Demo/assets/nested/pic.png', { binary: true, content: 'aW1hZ2U=' });
  assert.equal((await store.read('Demo/assets/nested/pic.png', true)).content, 'aW1hZ2U=');
  await store.write('Demo/Demo.md', { binary: false, content: 'Complete' });
  assert.equal((await store.read('Demo/Demo.md', false)).content, 'Complete');
  await store.remove('Demo/Demo.md'); assert.equal(await store.read('Demo/Demo.md', false), null);
});
test('PATH discovery excludes relative directories and Windows duplicates', () => {
  assert.equal(cli.mergePath(['/bin', '/opt/bin'], '.:/bin:/usr/bin:', 'linux'), '/bin:/usr/bin:/opt/bin');
  assert.equal(cli.mergePath(['C:\\BIN', 'D:\\tools'], 'C:\\bin;.;', 'win32'), 'C:\\bin;D:\\tools');
});
test('all six invocations inherit model configuration and avoid model flags', () => {
  for (const provider of cli.CLI_PROVIDERS) {
    const command = cli.invocation({ provider, prefix: [], help: '--trust' }, '/tmp/work', { NATIVE: 'value' });
    assert.equal(command.env.NATIVE, 'value');
    assert.equal(command.env.PWD, '/tmp/work');
    assert.ok(!command.args.includes('--model') && !command.args.includes('-m'));
    assert.ok(!command.args.includes('--ignore-user-config') && !command.args.includes('--safe-mode'));
  }
  const command = cli.invocation({ provider: 'opencode' }, '/tmp/work', {});
  assert.equal(command.args[command.args.indexOf('--dir') + 1], '/tmp/work');
  const permissions = JSON.parse(command.env.OPENCODE_CONFIG_CONTENT).permission;
  assert.equal(permissions.edit['tmp/work/backup.md'], 'allow');
  assert.equal(permissions.external_directory, 'deny');
  assert.equal(cli.terminalFailure({ event: 'result', result: { status: 'ERROR' } }), true);
  assert.equal(cli.terminalFailure({ type: 'result', exit_code: 1 }), true);
});
test('npm wrappers are resolved to Node entry points without executing shell contents', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'marker-shim-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const shim = path.join(root, 'codex.cmd'); await fs.writeFile(shim, 'malicious command must never run'); await fs.chmod(shim, 0o755);
  const packageRoot = path.join(root, 'node_modules', '@openai', 'codex'); await fs.mkdir(packageRoot, { recursive: true });
  await fs.writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ bin: { codex: 'cli.js' } }));
  await fs.writeFile(path.join(packageRoot, 'cli.js'), 'console.log("Codex");');
  await fs.symlink(process.execPath, path.join(root, process.platform === 'win32' ? 'node.exe' : 'node'));
  const launch = await cli.resolveLaunch('codex', shim, { PATH: root });
  assert.equal(launch.executable, path.join(root, process.platform === 'win32' ? 'node.exe' : 'node'));
  assert.deepEqual(launch.prefix, [path.join(packageRoot, 'cli.js')]);
});
test('override validation probes fake CLI without accepting an unrelated executable', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'marker-detect-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const fake = path.join(root, 'codex'); await fs.copyFile(fixture, fake); await fs.chmod(fake, 0o755);
  const detector = new cli.CliDetector({ codex: fake, cursor: process.execPath });
  assert.equal((await detector.detect('codex')).status, 'ready');
  assert.equal((await detector.detect('cursor')).status, 'incompatible');
});
test('preparation respects images, HTML, metadata, and external image URLs', () => {
  const settings = { extractContent: 'all', createAssetSubfolder: true, writeMetadata: true, saveHtmlOutput: true, movePDFtoFolder: false, deleteOriginal: false };
  const result = cli.prepareArtifacts({ success: true, markdown: '# Demo\n![x](pic.png) ![remote](https://example.com/pic.png)', html: '<img src="pic.png">',
    images: { 'pic.png': 'aW1hZ2U=' }, metadata: { languages: ['en'], failed_pages: [2], ignored: 'no' } }, settings,
    { name: 'Demo.pdf', basename: 'Demo', path: 'Demo.pdf' }, 'Demo/', { parse: JSON.parse, stringify: JSON.stringify });
  assert.match(result.files[result.markdownPath].content, /assets\/Demo_pic.png/);
  assert.match(result.files[result.markdownPath].content, /https:\/\/example.com\/pic.png/);
  assert.ok(!result.files[result.markdownPath].content.includes('ignored'));
  assert.match(result.files['Demo/Demo.html'].content, /assets\/Demo_pic.png/);
  assert.throws(() => cli.prepareArtifacts({ success: true, images: { '../escape.png': '' } }, settings,
    { name: 'Demo.pdf', basename: 'Demo', path: 'Demo.pdf' }, 'Demo/', {}), /Invalid output path/);
});
test('image preparation handles spaces, titles, balanced parentheses, references, and wiki embeds', () => {
  const text = '# Demo\n![a](pic(1).png "Caption") ![b](<pic 2.png>) ![c][figure] ![[pic(1).png|100]]\n[figure]: pic(1).png "Title"\n';
  const settings = { extractContent: 'all', createAssetSubfolder: true };
  const data = { success: true, markdown: text, images: { 'pic(1).png': 'YQ==', 'pic 2.png': 'Yg==' } };
  const result = cli.prepareArtifacts(data, settings, { name: 'Demo.pdf', basename: 'Demo', path: 'Demo.pdf' }, 'Demo/', {});
  const markdown = result.files[result.markdownPath].content;
  assert.match(markdown, /assets\/Demo_pic\(1\).png "Caption"/);
  assert.match(markdown, /<assets\/Demo_pic%202.png>/);
  assert.match(markdown, /\[figure\]: assets\/Demo_pic\(1\).png "Title"/);
  assert.match(markdown, /!\[\[assets\/Demo_pic\(1\).png\|100\]\]/);
});
test('NVM discovery prefers the configured default over newer installed versions', async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'marker-nvm-'));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  await fs.mkdir(path.join(home, '.nvm', 'alias'), { recursive: true });
  await fs.writeFile(path.join(home, '.nvm', 'alias', 'default'), '22');
  await fs.mkdir(path.join(home, '.nvm', 'versions', 'node', 'v22.1.0'), { recursive: true });
  await fs.mkdir(path.join(home, '.nvm', 'versions', 'node', 'v99.0.0'), { recursive: true });
  const dirs = cli.searchDirectories({}, home, 'linux');
  assert.ok(dirs.indexOf(path.join(home, '.nvm', 'versions', 'node', 'v22.1.0', 'bin')) <
    dirs.indexOf(path.join(home, '.nvm', 'versions', 'node', 'v99.0.0', 'bin')));
});
test('validation rejects lost data and accepts true duplicate numeric footnotes', () => {
  const original = '---\ntag: intact\n---\n# Demo\nValue: 42 on 2026-10-06\n[x](a.pdf)\n```js\nconst n = 42;\n```\n$$a + b$$\n';
  assert.doesNotThrow(() => cli.validateFormatted(original, original.replace('# Demo', '## Demo')));
  for (const [from, to] of [['tag: intact', 'tag: changed'], ['42', '41'], ['a.pdf', 'b.pdf'], ['a + b', 'a - b'], ['const n', 'let n']]) {
    assert.throws(() => cli.validateFormatted(original, original.replaceAll(from, to)));
  }
  assert.doesNotThrow(() => cli.validateFormatted('Footnote: 42\nFootnote: 42', 'Footnote: 42'));
  assert.doesNotThrow(() => cli.validateFormatted('[^1]: Source 42\n[^2]: Source 42', '[^1]: Source 42'));
  assert.doesNotThrow(() => cli.validateFormatted('[source](<pic(1).png> "title") title', '[source](pic(1).png "title") title'));
  assert.throws(() => cli.validateFormatted('Unique: العربية', 'Unique: English'), /word or name/);
  assert.throws(() => cli.validateFormatted('```py\nprint("a  b")\n```', '```py\nprint("a b")\n```'), /code or math/);
});
test('formatting publishes attachments before complete Markdown and cleans staging', async t => {
  const context = await setup(t);
  assert.equal(await context.pipeline.process({ prepared: prepared(), formatting }), 'formatted');
  assert.deepEqual(context.store.writes, ['Demo/assets/demo.png', 'Demo/Demo.md']);
  assert.match(context.store.files.get('Demo/Demo.md').content, /# Demo\n\n/);
  assert.equal(context.completed.length, 1);
  assert.equal(context.completed[0][0].deleteOriginal, true);
  assert.deepEqual(await fs.readdir(context.root), []);
});
test('all six adapters work through the common pipeline with fake CLI processes', async t => {
  for (const provider of cli.CLI_PROVIDERS) {
    const context = await setup(t, { detector: fakeDetector(provider) });
    assert.equal(await context.pipeline.process({ prepared: prepared(), formatting: { ...formatting, cliProvider: provider } }), 'formatted', provider);
  }
});
test('retry starts from untouched extraction and imports raw after two failures', async t => {
  let attempts = 0;
  const original = prepared();
  const context = await setup(t, { runner: async (_cli, work) => {
    attempts++; assert.equal(await fs.readFile(path.join(work, 'document.md'), 'utf8'), original.files[original.markdownPath].content);
    await fs.writeFile(path.join(work, 'document.md'), 'partial'); throw new Error('Fixture failure');
  } });
  assert.equal(await context.pipeline.process({ prepared: original, formatting }), 'raw');
  assert.equal(attempts, 2);
  assert.equal(context.store.files.get(original.markdownPath).content, original.files[original.markdownPath].content);
  assert.equal(context.completed[0][0].deleteOriginal, false);
});
test('a successful retry uses a fresh document and report', async t => {
  let calls = 0;
  const context = await setup(t, { runner: async (...args) => {
    if (++calls === 1) { await fs.writeFile(path.join(args[1], '.format-result.json'), '{}'); throw new Error('fail'); }
    await assert.rejects(fs.readFile(path.join(args[1], '.format-result.json')));
    await fakeComplete(...args);
  } });
  assert.equal(await context.pipeline.process({ prepared: prepared(), formatting }), 'formatted');
  assert.equal(calls, 2);
});
test('exit zero without a report, empty edits, and terminal error events fall back to raw', async t => {
  for (const mode of ['no-report', 'empty', 'event-error']) {
    const context = await setup(t, { detector: fakeDetector('codex', { MARKER_FAKE_MODE: mode }) });
    assert.equal(await context.pipeline.process({ prepared: prepared(), formatting }), 'raw', mode);
    assert.equal(context.completed[0][0].deleteOriginal, false);
  }
});
test('disabled formatting, images-only output, and mobile perform no subprocess work', async t => {
  for (const mode of ['disabled', 'images', 'mobile']) {
    let calls = 0;
    const context = await setup(t, { desktop: mode !== 'mobile', runner: async () => { calls++; } });
    const output = prepared();
    if (mode === 'images') { delete output.files[output.markdownPath]; delete output.markdownPath; }
    assert.equal(await context.pipeline.process({ prepared: output, formatting: { ...formatting, cliFormattingEnabled: mode !== 'disabled' } }), 'raw');
    assert.equal(calls, 0);
    assert.equal(context.completed[0][0].deleteOriginal, mode !== 'mobile');
  }
});
test('destination conflicts prevent publication and retain recoverable extraction', async t => {
  const store = memoryStore();
  const context = await setup(t, { store, runner: async (...args) => {
    await fakeComplete(...args); store.files.set('Demo/Demo.md', { content: 'User edit', binary: false });
  } });
  assert.equal(await context.pipeline.process({ prepared: prepared(), formatting }), 'failed');
  assert.equal(store.files.get('Demo/Demo.md').content, 'User edit');
  assert.equal(context.completed.length, 0);
  assert.equal(context.pipeline.pendingJobs.length, 1);
});
test('publication failures restore overwritten assets and notes', async t => {
  const store = memoryStore();
  store.files.set('Demo/assets/demo.png', { content: 'b2xk', binary: true });
  store.files.set('Demo/Demo.md', { content: 'Old note', binary: false });
  const write = store.write;
  let failed = false;
  store.write = async (key, value) => {
    await write(key, value);
    if (key.endsWith('.md') && !failed) { failed = true; throw new Error('disk error after write'); }
  };
  const context = await setup(t, { store });
  assert.equal(await context.pipeline.process({ prepared: prepared(), formatting }), 'failed');
  assert.equal(store.files.get('Demo/assets/demo.png').content, 'b2xk');
  assert.equal(store.files.get('Demo/Demo.md').content, 'Old note');
  assert.equal(context.completed.length, 0);
});
test('cancellation kills the process tree, prevents publication, and keeps recovery', async t => {
  const context = await setup(t, { detector: fakeDetector('codex', { MARKER_FAKE_MODE: 'hang', MARKER_FAKE_CHILD: '1' }) });
  const result = context.pipeline.process({ prepared: prepared(), formatting });
  let work;
  for (let i = 0; i < 200; i++) {
    const active = context.pipeline.runningJobs[0];
    work = active && path.join(context.root, 'job-' + active.id, 'work');
    if (work && await fs.stat(path.join(work, 'started.txt')).catch(() => false)) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  context.pipeline.cancel(context.pipeline.runningJobs[0].id);
  assert.equal(await result, 'cancelled');
  assert.equal(context.store.files.size, 0);
  assert.equal(context.pipeline.pendingJobs.length, 1);
  await new Promise(resolve => setTimeout(resolve, 1100));
  await assert.rejects(fs.stat(path.join(work, 'late.txt')));
});
test('timeout retries once and imports raw without source deletion', async t => {
  const context = await setup(t, { detector: fakeDetector('codex', { MARKER_FAKE_MODE: 'hang' }) });
  assert.equal(await context.pipeline.process({ prepared: prepared(), formatting: { ...formatting, cliTimeoutMinutes: 0.002 } }), 'raw');
  assert.equal(context.completed[0][0].deleteOriginal, false);
});
test('recovery does not restart agents or persist API keys and retains the source', async t => {
  const context = await setup(t, { runner: async (...args) => { await fakeComplete(...args); context.pipeline.dispose(); } });
  assert.equal(await context.pipeline.process({ prepared: prepared(), formatting }), 'cancelled');
  let inspected = false;
  const next = new cli.FormattingPipeline(context.host, true, context.identity, fakeDetector(), async (...args) => {
    const manifest = await fs.readFile(path.join(args[1], '..', 'job.json'), 'utf8');
    assert.ok(!manifest.includes('SECRET-SHOULD-NOT-PERSIST')); inspected = true;
    await fakeComplete(...args);
  });
  t.after(() => next.dispose());
  await next.initialize();
  assert.equal(next.runningJobs.length, 0);
  assert.equal(next.pendingJobs.length, 1);
  const id = next.pendingJobs[0].id;
  const result = await next.recover(id, false, { ...formatting, apiKey: 'SECRET-SHOULD-NOT-PERSIST' });
  assert.equal(result, 'formatted');
  assert.equal(context.completed[0][2], true);
  assert.equal(next.pendingJobs.length, 0);
  assert.equal(inspected, true);
});
test('preparation writes the raw extraction backup into assets when enabled', () => {
  const settings = { extractContent: 'all', createAssetSubfolder: true, backupRawExtraction: true };
  const result = cli.prepareArtifacts({ success: true, markdown: '# Demo\n', images: { 'pic.png': 'aW1hZ2U=' } }, settings,
    { name: 'Demo.pdf', basename: 'Demo', path: 'Demo.pdf' }, 'Demo/', {});
  const backup = result.files['Demo/assets/Demo.md.backup'];
  assert.equal(backup.binary, false);
  assert.equal(backup.content, result.files[result.markdownPath].content);
  const plain = cli.prepareArtifacts({ success: true, markdown: '# Demo\n', images: { 'pic.png': 'aW1hZ2U=' } },
    { extractContent: 'all', createAssetSubfolder: true },
    { name: 'Demo.pdf', basename: 'Demo', path: 'Demo.pdf' }, 'Demo/', {});
  assert.equal(plain.files['Demo/assets/Demo.md.backup'], undefined);
  const imagesOnly = cli.prepareArtifacts({ success: true, markdown: '# Demo\n', images: { 'pic.png': 'aW1hZ2U=' } },
    { extractContent: 'images', createAssetSubfolder: true, backupRawExtraction: true },
    { name: 'Demo.pdf', basename: 'Demo', path: 'Demo.pdf' }, 'Demo/', {});
  assert.equal(imagesOnly.files['Demo/assets/Demo.md.backup'], undefined);
});
test('jobs snapshot settings, run in parallel across destinations, and unload prevents late writes', async t => {
  let release;
  let running = 0; let maximum = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const context = await setup(t, { runner: async (...args) => {
    maximum = Math.max(maximum, ++running); await gate; await fakeComplete(...args); running--;
  } });
  const preferences = { ...formatting };
  const first = context.pipeline.process({ prepared: prepared(), formatting: preferences });
  const secondPrepared = prepared();
  secondPrepared.folderPath = 'Other/'; secondPrepared.originalName = 'Other.pdf'; secondPrepared.markdownPath = 'Other/Other.md';
  secondPrepared.files = { 'Other/assets/demo.png': { binary: true, content: Buffer.from('image').toString('base64') },
    'Other/Other.md': { binary: false, content: '# Other\n' } };
  const second = context.pipeline.process({ prepared: secondPrepared, formatting: preferences });
  preferences.cliProvider = ''; preferences.cliFormattingEnabled = false;
  for (let i = 0; i < 200 && running < 2; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(maximum, 2);
  context.pipeline.dispose(); release();
  assert.equal(await first, 'cancelled'); assert.equal(await second, 'cancelled');
  assert.equal(context.store.files.size, 0);
  assert.equal(context.pipeline.pendingJobs.length, 2);
});
test('jobs targeting the same destination are serialized', async t => {
  let release;
  let running = 0; let maximum = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const context = await setup(t, { runner: async (...args) => {
    maximum = Math.max(maximum, ++running); await gate; await fakeComplete(...args); running--;
  } });
  const first = context.pipeline.process({ prepared: prepared(), formatting });
  const second = context.pipeline.process({ prepared: prepared(), formatting });
  for (let i = 0; i < 200 && !running; i++) await new Promise(resolve => setTimeout(resolve, 10));
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(maximum, 1);
  release();
  assert.equal(await first, 'formatted'); assert.equal(await second, 'formatted');
  assert.equal(context.pipeline.pendingJobs.length, 0);
});
