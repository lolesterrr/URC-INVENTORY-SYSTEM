// Cloud sessions: commit as lolesterrr, unsigned (see "Commits" in CLAUDE.md).
import { execFileSync } from 'node:child_process';

if (process.env.CLAUDE_CODE_REMOTE === 'true') {
  const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const set = (key, value) => execFileSync('git', ['config', key, value], { cwd });
  set('user.name', 'lolesterrr');
  set('user.email', '178182850+lolesterrr@users.noreply.github.com');
  set('commit.gpgsign', 'false');
}
