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
