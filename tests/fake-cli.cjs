#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
if (process.argv.includes('--help')) {
  console.log('Codex Claude Usage of agy Cursor Agent opencode run Hermes --sandbox --skip-git-repo-check --cd --dir --json --print --allowedTools --tools --permission-mode --output-format --force --format --query-file --oneshot');
  process.exit(0);
}
const mode = process.env.MARKER_FAKE_MODE || 'success';
if (mode === 'hang') {
  if (process.env.MARKER_FAKE_CHILD) {
    require('node:child_process').spawn(process.execPath, ['-e', 'setTimeout(() => require("node:fs").writeFileSync("late.txt", "late"), 1000); setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  }
  fs.writeFileSync('started.txt', 'started');
  setInterval(() => {}, 1000);
} else {
  if (mode === 'fail') { console.error('not authenticated'); process.exit(1); }
  if (mode === 'event-error') { console.log('{"type":"result","is_error":true}'); process.exit(0); }
  const prompt = fs.readFileSync('prompt.txt', 'utf8');
  const report = prompt.match(/\{"jobId":"[^"\n]+","completed":true,"reviewed":true\}/)?.[0];
  if (mode !== 'no-report') fs.writeFileSync('.format-result.json', report || '{}');
  if (mode === 'empty') fs.writeFileSync('document.md', '');
  else fs.writeFileSync('document.md', fs.readFileSync('document.md', 'utf8').replace('# Demo', '# Demo\n'));
  console.log(JSON.stringify({ type: 'system', model: 'native-default-model' }));
  console.log(JSON.stringify({ type: 'result', is_error: false }));
}
