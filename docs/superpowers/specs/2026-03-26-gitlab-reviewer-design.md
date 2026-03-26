# GitLab MR Code Review Webhook Service

## Context

User wants a Node.js service that receives GitLab merge request webhook events, triggers Claude Code for code review, and posts review comments back to the MR using the already-configured GitLab MCP. The service runs on the same Mac mini as GitLab.

## Architecture

```
┌─────────────┐     POST /webhook     ┌──────────────────────┐
│   GitLab    │ ────────────────────▶│   Node.js Service     │
│  (webhook)  │   X-Gitlab-Token     │  (Express + webhooks) │
└─────────────┘                       └──────────┬───────────┘
                                                  │
                                    1. Validate token
                                    2. Check target branch
                                    3. Fetch MR diff (GitLab API)
                                    4. Pipe diff to Claude --print
                                    5. Claude reviews + posts comment via MCP
```

## Project Structure

```
/Users/norcleeh/gitlab-reviewer/
├── index.js              # Main entry, Express server
├── src/
│   ├── server.js         # Express app setup
│   ├── routes/
│   │   └── webhook.js    # POST /webhook handler
│   ├── services/
│   │   ├── gitlab.js     # GitLab API calls (fetch diff, post comment)
│   │   └── claude.js     # Spawn Claude CLI, handle stdin/stdout
│   └── middleware/
│       └── auth.js       # X-Gitlab-Token verification
├── .env                  # Webhook secret, target branches
├── .env.example          # Template
├── package.json
└── pm2.config.js         # PM2 configuration
```

## Key Flows

### Webhook Handler Flow

1. GitLab sends POST to `/webhook` with `X-Gitlab-Token` header
2. Middleware validates token against `.env` (GITLAB_WEBHOOK_SECRET)
3. Parse MR info from webhook payload (project path, MR IID, source/target branch)
4. Check if target branch is in allowed list from `.env` (TARGET_BRANCHES)
5. Fetch full MR diff via GitLab API using the user's GitLab MCP token
6. Spawn `claude --print` with review prompt + diff on stdin
7. Parse Claude's output and post as MR comment via GitLab API

### .env Configuration

```
GITLAB_WEBHOOK_SECRET=your_secret_here
TARGET_BRANCHES=main,master,release
PORT=5010
```

## Error Handling

- Invalid token → 401 response, log attempt
- Branch not in target list → 200 response (silently ignore)
- GitLab API failure → log error, no retry
- Claude timeout/failure → log error, no retry
- Success → log posted comment URL

## Dependencies

- express (web server)
- axios (GitLab API calls)
- dotenv (environment variables)
- pm2 (process manager)

## Security Considerations

- X-Gitlab-Token header verification on every request
- Token stored in .env, not hardcoded
- .env should be in .gitignore

## Deployment

- Run with PM2 on macOS
- Auto-restart on crash
- Log output managed by PM2
