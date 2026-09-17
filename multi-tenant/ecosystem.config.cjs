module.exports = {
  apps: [
    {
      name: "mova-backend",
      cwd: "./backend",
      script: "index.ts",
      interpreter: "bun",
      env: {
        NODE_ENV: "production",
        PORT: 9968
      },
      restart_delay: 3000,
      max_restarts: 10
    },
    {
      name: "mova-frontend",
      cwd: "./frontend",
      script: "node_modules/vite/bin/vite.js",
      args: "preview --port 9967 --host",
      interpreter: "bun",
      env: {
        NODE_ENV: "production"
      },
      restart_delay: 3000,
      max_restarts: 10
    }
  ]
};
