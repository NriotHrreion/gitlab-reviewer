require('dotenv').config();
const { createServer } = require('./src/server');

const port = process.env.PORT || 5010;
const app = createServer();

app.listen(port, () => {
  console.log(`[SERVER] GitLab Reviewer listening on port ${port}`);
});
