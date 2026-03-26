# Gitlab Reviewer

This is a Gitlab webhook receiver that can automatically call Claude Code to review the code you just pushed to a Merge Request.

## Prerequisite

Have a Claude Code installed on your machine, with a Gitlab MCP server.

For the MCP server, [zereight/gitlab-mcp](https://github.com/zereight/gitlab-mcp) is recommended.

## Getting Started

1. Clone the repo

```
git clone https://github.com/NriotHrreion/gitlab-reviewer.git
```

2. Install npm dependencies

```
npm install
```

3. Create a `.env` file in the project root and fill in the 3 environment variables

```
cp .env.example .env
vi .env
```

4. Run the service

```
node index
```

5. Create a new webhook in Gitlab

In your Gitlab instance, go to `Your Project > Settings > Webhooks`, click "Add new webhook". Fill in the `URL` field with the following pattern:

```
http://<your_host_ip>:5010/webhook
```

Then fill in the `Secret token` field with the `GITLAB_WEBHOOK_SECRET` you just set in the `.env` file, check the option "Merge request events", and click "Add webhook".

## License

[MIT](./LICENSE)
