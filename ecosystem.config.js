module.exports = {
  apps: [
    {
      name: 'domApi',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3003,
        WEBSOCKET_PORT: process.env.WEBSOCKET_PORT || 3004,
      },
      error_file: './logs/domApi-error.log',
      out_file: './logs/domApi-out.log',
      log_file: './logs/domApi.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      kill_timeout: 3000,
      listen_timeout: 3000,
      exec_mode: 'fork',
    },
  ],
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'localhost',
      ref: 'origin/master',
      repo: 'git@github.com:viap/dom-api.git',
      path: '/root/projects/dom-api',
      'post-deploy':
        'npm install && pm2 reload ecosystem.config.js --env production',
    },
  },
};
