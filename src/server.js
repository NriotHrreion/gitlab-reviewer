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
