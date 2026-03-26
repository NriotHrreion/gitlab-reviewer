# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GitLab webhook receiver that automatically triggers Claude Code to review Merge Requests. When an MR is opened/updated targeting specified branches, this service spawns Claude with GitLab MCP tools to fetch the diff and post a code review comment.

## Commands

```bash
npm install        # Install dependencies
node index         # Start the server (requires .env configuration)
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITLAB_WEBHOOK_SECRET` | Yes | Secret token for webhook authentication |
| `TARGET_BRANCHES` | Yes | Comma-separated list of branches to trigger reviews (e.g., `main,master,release`) |
| `PORT` | No | Server port (default: 5010) |

## Architecture

```
index.js                    # Entry point - loads env, creates server
src/server.js               # Express app factory (health check, auth middleware)
src/routes/webhook.js       # POST /webhook - validates MR events, filters by target branch
src/middleware/auth.js      # Validates x-gitlab-token header using timing-safe comparison
src/services/claude.js      # Spawns `claude --print --allowedTools mcp__gitlab__*` for review
```

## Request Flow

1. GitLab POSTs to `/webhook` with `x-gitlab-token` header
2. `authMiddleware` validates the token
3. `webhook.js` validates the payload structure and filters by:
   - `object_kind === 'merge_request'`
   - `state === 'opened' | 'updated'`
   - `target_branch` is in `TARGET_BRANCHES`
4. `runClaudeReview()` spawns Claude CLI with the project path and MR IID
5. Claude (with GitLab MCP tools) fetches the MR diff, reviews it, and posts a comment

## Important Notes

- Claude is spawned with `--allowedTools mcp__gitlab__*` to restrict to GitLab MCP tools only
- The spawned process uses `NODE_OPTIONS="--use-system-ca"` for certificate handling
- Reviews timeout after 2 minutes (120000ms)
- The service only processes MRs targeting branches in the `TARGET_BRANCHES` list
