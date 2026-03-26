const crypto = require('crypto');

function authMiddleware(req, res, next) {
  const token = req.headers['x-gitlab-token'];
  const expectedToken = process.env.GITLAB_WEBHOOK_SECRET;

  if (!token || !expectedToken) {
    console.log(`[AUTH] Invalid token attempt from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expectedToken);

  if (tokenBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)) {
    console.log(`[AUTH] Invalid token attempt from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = authMiddleware;
