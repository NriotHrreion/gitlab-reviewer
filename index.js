require('dotenv').config();
const { createServer } = require('./src/server');

const port = process.env.PORT || 5010;

(async () => {
  const app = createServer();

  const server = app.listen(port, () => {
    console.log(`[SERVER] GitLab Reviewer listening on port ${port}`);
  });

  server.on('error', (err) => {
    console.error(`[SERVER] Failed to start: ${err.message}`);
    process.exit(1);
  });

  const shutdown = () => {
    console.log('[SERVER] Shutting down gracefully...');
    server.close(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
})();
