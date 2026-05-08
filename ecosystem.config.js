module.exports = {
  apps: [
    {
      name: 'domApi',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {},
      // Restart settings
      max_restarts: 5,
      min_uptime: '10s',
      //logging
      error_file: './logs/domApi-error.log',
      out_file: './logs/domApi-out.log',
      log_file: './logs/domApi.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Graceful shutdown
      kill_timeout: 3000,
      wait_ready: true,
      listen_timeout: 3000,
      restart_delay: 4000,
      time: true,
      // Health check
      health_check_grace_period: 3000,
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
