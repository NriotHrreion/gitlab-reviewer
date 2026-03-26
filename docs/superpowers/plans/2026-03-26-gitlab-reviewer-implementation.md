# GitLab MR Code Review Webhook Service - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js webhook service that receives GitLab MR events, triggers Claude Code for review, and posts review comments to the MR.

**Architecture:** Express.js web server receives webhook POST requests, validates X-Gitlab-Token header and target branch, fetches MR diff via GitLab API, pipes diff to Claude Code CLI via stdin, then posts Claude's output as an MR comment.

**Tech Stack:** Node.js, Express, axios, dotenv, PM2

---

## File Structure

```
/Users/norcleeh/gitlab-reviewer/
├── index.js              # Main entry point
├── src/
│   ├── server.js         # Express app setup
│   ├── routes/
│   │   └── webhook.js    # POST /webhook handler
│   ├── services/
│   │   ├── gitlab.js     # GitLab API calls (fetch diff, post comment)
│   │   └── claude.js     # Spawn Claude CLI, handle stdin/stdout
│   └── middleware/
│       └── auth.js       # X-Gitlab-Token verification
├── .env.example          # Template
├── .gitignore
├── package.json
└── pm2.config.js        # PM2 configuration
```

---

## Task 1: Initialize Node.js Project

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "gitlab-reviewer",
  "version": "1.0.0",
  "description": "GitLab MR Code Review Webhook Service",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "dotenv": "^16.3.1",
    "express": "^4.18.2"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
.env
```

- [ ] **Step 3: Create .env.example**

```
GITLAB_WEBHOOK_SECRET=your_webhook_secret_here
GITLAB_TOKEN=your_gitlab_api_token_here
TARGET_BRANCHES=main,master,release
PORT=5010
```

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore .env.example
git commit -m "feat: initialize Node.js project with dependencies"
```

---

## Task 2: Create Auth Middleware

**Files:**
- Create: `src/middleware/auth.js`

- [ ] **Step 1: Create src/middleware/auth.js**

```javascript
function authMiddleware(req, res, next) {
  const token = req.headers['x-gitlab-token'];
  const expectedToken = process.env.GITLAB_WEBHOOK_SECRET;

  if (!token || token !== expectedToken) {
    console.log(`[AUTH] Invalid token attempt from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = authMiddleware;
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware/auth.js
git commit -m "feat: add X-Gitlab-Token auth middleware"
```

---

## Task 3: Create GitLab Service

**Files:**
- Create: `src/services/gitlab.js`

- [ ] **Step 1: Create src/services/gitlab.js**

```javascript
const axios = require('axios');

const GITLAB_API_URL = process.env.GITLAB_API_URL || 'https://gitlab.com/api/v4';

function createGitLabClient() {
  return axios.create({
    baseURL: GITLAB_API_URL,
    headers: {
      'PRIVATE-TOKEN': process.env.GITLAB_TOKEN,
    },
  });
}

async function getMRDiff(projectId, mrIid) {
  const client = createGitLabClient();
  const response = await client.get(`/projects/${encodeURIComponent(projectId)}/merge_requests/${mrIid}/changes`);
  return response.data.changes.map(change => change.diff).join('\n');
}

async function postMRComment(projectId, mrIid, body) {
  const client = createGitLabClient();
  await client.post(`/projects/${encodeURIComponent(projectId)}/merge_requests/${mrIid}/notes`, {
    body,
  });
  console.log(`[GITLAB] Comment posted to MR !${mrIid}`);
}

module.exports = {
  getMRDiff,
  postMRComment,
};
```

- [ ] **Step 2: Commit**

```bash
git add src/services/gitlab.js
git commit -m "feat: add GitLab API service for fetching diffs and posting comments"
```

---

## Task 4: Create Claude Service

**Files:**
- Create: `src/services/claude.js`

- [ ] **Step 1: Create src/services/claude.js**

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/services/claude.js
git commit -m "feat: add Claude CLI spawning service for code reviews"
```

---

## Task 5: Create Webhook Route

**Files:**
- Create: `src/routes/webhook.js`

- [ ] **Step 1: Create src/routes/webhook.js**

```javascript
const express = require('express');
const { getMRDiff, postMRComment } = require('../services/gitlab');
const { runClaudeReview } = require('../services/claude');

const router = express.Router();

function isTargetBranch(targetBranch) {
  const allowedBranches = process.env.TARGET_BRANCHES.split(',').map(b => b.trim());
  return allowedBranches.includes(targetBranch);
}

router.post('/webhook', async (req, res) => {
  const { object_kind, project, object_attributes } = req.body;

  // Only handle merge request events
  if (object_kind !== 'merge_request') {
    return res.status(200).json({ message: 'Ignored: not a merge request' });
  }

  const { source_branch, target_branch, iid, state } = object_attributes;

  // Only review when MR is opened or updated
  if (!['opened', 'updated'].includes(state)) {
    return res.status(200).json({ message: 'Ignored: MR not opened or updated' });
  }

  // Check if target branch is in allowed list
  if (!isTargetBranch(target_branch)) {
    console.log(`[WEBHOOK] Ignored: ${target_branch} not in target branches`);
    return res.status(200).json({ message: 'Ignored: target branch not in list' });
  }

  const projectId = project.path_with_namespace;

  try {
    console.log(`[WEBHOOK] Processing MR !${iid} (${source_branch} → ${target_branch})`);

    // Fetch diff
    const diff = await getMRDiff(projectId, iid);

    if (!diff) {
      console.log(`[WEBHOOK] No diff fetched for MR !${iid}`);
      return res.status(200).json({ message: 'No changes in MR' });
    }

    // Run Claude review
    const review = await runClaudeReview(diff);

    // Post comment
    const commentBody = `## Claude Code Review\n\n${review}`;
    await postMRComment(projectId, iid, commentBody);

    res.status(200).json({ message: 'Review posted successfully' });
  } catch (error) {
    console.error(`[WEBHOOK] Error processing MR !${iid}:`, error.message);
    res.status(500).json({ error: 'Review failed' });
  }
});

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/webhook.js
git commit -m "feat: add webhook route handler for MR events"
```

---

## Task 6: Create Express Server

**Files:**
- Create: `src/server.js`

- [ ] **Step 1: Create src/server.js**

```javascript
const express = require('express');
const webhookRouter = require('./routes/webhook');
const authMiddleware = require('./middleware/auth');

function createServer() {
  const app = express();

  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(authMiddleware);
  app.use(webhookRouter);

  return app;
}

module.exports = { createServer };
```

- [ ] **Step 2: Commit**

```bash
git add src/server.js
git commit -m "feat: create Express server with routes and middleware"
```

---

## Task 7: Create Main Entry Point

**Files:**
- Create: `index.js`

- [ ] **Step 1: Create index.js**

```javascript
require('dotenv').config();
const { createServer } = require('./src/server');

const port = process.env.PORT || 5010;
const app = createServer();

app.listen(port, () => {
  console.log(`[SERVER] GitLab Reviewer listening on port ${port}`);
});
```

- [ ] **Step 2: Commit**

```bash
git add index.js
git commit -m "feat: add main entry point"
```

---

## Task 8: Create PM2 Configuration

**Files:**
- Create: `pm2.config.js`

- [ ] **Step 1: Create pm2.config.js**

```javascript
module.exports = {
  apps: [
    {
      name: 'gitlab-reviewer',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add pm2.config.js
git commit -m "feat: add PM2 configuration for production deployment"
```

---

## Verification

After implementing all tasks:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Copy and configure .env:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual tokens
   ```

3. **Start the service:**
   ```bash
   npm start
   ```

4. **Test health endpoint:**
   ```bash
   curl http://localhost:5010/health
   ```

5. **Configure GitLab webhook:**
   - Go to GitLab project → Settings → Webhooks
   - URL: `http://your-server:5010/webhook`
   - Secret token: same as `GITLAB_WEBHOOK_SECRET` in .env
   - Trigger: Merge request events
   - Test with a merge request targeting main/master/release
