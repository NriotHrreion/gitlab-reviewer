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
