const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CLAUDE_TIMEOUT_MS = 600000; // 10 minutes

const PROMPTS_DIR = path.join(__dirname, '..', '..', 'prompts');
const WORKSPACES_DIR = path.join(__dirname, '..', '..', 'workspaces');

function sanitizeProjectPath(projectPath) {
  return projectPath.replace(/\//g, '-');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function cleanupDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function getPromptLanguage() {
  return process.env.CLAUDE_LANGUAGE || 'en';
}

function loadPrompt(templateName) {
  const lang = getPromptLanguage();
  const templatePath = path.join(PROMPTS_DIR, `${templateName}-${lang}.md`);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Prompt template not found: ${templatePath}`);
  }

  return fs.readFileSync(templatePath, 'utf8');
}

function renderPrompt(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

function runClaudeProcess(prompt, options = {}) {
  const { cwd, allowedTools } = options;

  return new Promise((resolve, reject) => {
    const args = ['--print', '--verbose'];
    if (allowedTools === '*') {
      // All built-in tools + all MCP tools
      args.push('--allowedTools', 'Read,Write,Edit,Bash,Grep,Glob,WebFetch,Bash(git:*),mcp__gitlab__*');
    } else if (allowedTools) {
      args.push('--allowedTools', allowedTools);
    } else {
      args.push('--allowedTools', 'mcp__gitlab__*');
    }

    const claude = spawn(
      'claude',
      args,
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, "NODE_OPTIONS": "--use-system-ca" },
        cwd: cwd || undefined,
      }
    );

    const chunks = [];
    let stderr = '';
    let settled = false;

    const settle = (fn) => {
      if (!settled) {
        settled = true;
        try {
          fn();
        } catch (settleErr) {
          console.error('[CLAUDE] settle error:', settleErr.message);
        }
      }
    };

    const timeout = setTimeout(() => {
      try {
        claude.kill('SIGKILL');
      } catch (killErr) {
        // Process may have already exited
        console.error('[CLAUDE] Claude process kill error:', killErr.message);
      }
      console.error('[CLAUDE] Claude process timed out');
      settle(() => reject(new Error('Claude process timed out')));
    }, CLAUDE_TIMEOUT_MS);

    try {
      claude.stdin.write(prompt);
    } catch (writeErr) {
      console.error('[CLAUDE] stdin write error:', writeErr.message);
    }
    try {
      claude.stdin.end();
    } catch (endErr) {
      // Ignore - may already be closed
    }

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
        settle(() => resolve(Buffer.concat(chunks).toString('utf8').trim()));
      } else {
        settle(() => reject(new Error(`Claude exited with code ${code}`)));
      }
    });

    claude.on('error', (err) => {
      clearTimeout(timeout);
      settle(() => reject(err));
    });
  });
}

function runClaudeMentionReply(projectPath, mrIid, discussionId, noteId, noteContent) {
  const template = loadPrompt('mention-reply');
  const prompt = renderPrompt(template, {
    projectPath,
    mrIid,
    mentionUsername: process.env.CLAUDE_MENTION_USERNAME,
    discussionId,
    noteId,
    noteContent,
  });
  return runClaudeProcess(prompt, { allowedTools: 'mcp__gitlab__*' });
}

function runClaudeReview(projectPath, mrIid) {
  const template = loadPrompt('code-review');
  const prompt = renderPrompt(template, {
    projectPath,
    mrIid,
  });
  return runClaudeProcess(prompt, { allowedTools: 'mcp__gitlab__*' });
}

function runClaudeIssueFix(projectPath, projectUrl, issueIid, issueTitle, issueDescription) {
  const template = loadPrompt('issue-fix');
  const prompt = renderPrompt(template, {
    projectPath,
    projectUrl,
    issueIid,
    issueTitle,
    issueDescription,
  });

  // Workspace path: workspaces/<sanitized-projectPath>/<issueIid>/
  const workspacePath = path.join(WORKSPACES_DIR, sanitizeProjectPath(projectPath), String(issueIid));

  console.log(`[CLAUDE] Creating workspace at ${workspacePath}`);
  ensureDir(workspacePath);

  const runProcess = runClaudeProcess(prompt, { cwd: workspacePath, allowedTools: '*' });

  // Always clean up workspace when process finishes
  runProcess.finally(() => {
    try {
      console.log(`[CLAUDE] Cleaning up workspace at ${workspacePath}`);
      cleanupDir(workspacePath);
    } catch (cleanupErr) {
      console.error(`[CLAUDE] Workspace cleanup failed:`, cleanupErr.message);
    }
  });

  return runProcess;
}

module.exports = { runClaudeReview, runClaudeMentionReply, runClaudeIssueFix };
