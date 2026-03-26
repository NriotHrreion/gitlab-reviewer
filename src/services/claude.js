const { spawn } = require('child_process');

const CLAUDE_TIMEOUT_MS = 120000; // 2 minutes

function runClaudeReview(projectPath, mrIid) {
  return new Promise((resolve, reject) => {
    const prompt = `You are a code reviewer for a GitLab merge request.

The merge request is:
- Project: ${projectPath}
- MR IID: ${mrIid}

Your task:
1. First, check what GitLab MCP tools are available to you
2. Use the GitLab MCP tool to fetch the merge request diff
3. Review the code changes for:
   - Potential bugs
   - Code quality issues
   - Security concerns
   - Performance problems
   - Missing error handling
4. Post your review as a comment on the merge request using the GitLab MCP tool

Provide a thorough code review in markdown format. Be critical but constructive.`;

    const claude = spawn(
      'claude',
      [
        '--print',
        '--allowedTools', 'mcp__gitlab__*',
        '--verbose',
      ],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, "NODE_OPTIONS": "--use-system-ca" },
      }
    );

    const chunks = [];
    let stderr = '';

    const timeout = setTimeout(() => {
      claude.kill('SIGKILL');
      reject(new Error('Claude review timed out'));
    }, CLAUDE_TIMEOUT_MS);

    claude.stdin.write(prompt);
    claude.stdin.end();

    claude.stdout.on('data', (data) => {
      chunks.push(data);
      process.stdout.write(data);
    });

    claude.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    claude.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString('utf8').trim());
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
