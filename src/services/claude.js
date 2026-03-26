const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CLAUDE_TIMEOUT_MS = 120000; // 2 minutes

const PROMPTS_DIR = path.join(__dirname, '..', '..', 'prompts');

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

function runClaudeProcess(prompt) {
  return new Promise((resolve, reject) => {
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
      reject(new Error('Claude process timed out'));
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
  return runClaudeProcess(prompt);
}

function runClaudeReview(projectPath, mrIid) {
  const template = loadPrompt('code-review');
  const prompt = renderPrompt(template, {
    projectPath,
    mrIid,
  });
  return runClaudeProcess(prompt);
}

module.exports = { runClaudeReview, runClaudeMentionReply };
