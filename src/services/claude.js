const { spawn } = require('child_process');

const CLAUDE_TIMEOUT_MS = 120000; // 2 minutes

function runClaudeReview(diff) {
  return new Promise((resolve, reject) => {
    const prompt = `You are a code reviewer. Review the following merge request diff and provide a concise code review focusing on:
- Potential bugs
- Code quality issues
- Security concerns
- Performance problems
- Missing error handling

Diff:
${diff}

Provide your review in markdown format. Be thorough but focused on the most important issues.`;

    const claude = spawn('claude', ['--print'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      claude.kill();
      reject(new Error('Claude review timed out'));
    }, CLAUDE_TIMEOUT_MS);

    claude.stdin.write(prompt);
    claude.stdin.end();

    claude.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    claude.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    claude.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        console.error(`[CLAUDE] stderr: ${stderr}`);
        reject(new Error(`Claude exited with code ${code}`));
      }
    });

    claude.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

module.exports = { runClaudeReview };
