/**
 * Cron runner — panggil dari /etc/cron.d/panel:
 *   * * * * * www-data cd /opt/panel && /usr/bin/node scripts/cron-runner.js metrics
 *   * * * * * www-data cd /opt/panel && /usr/bin/node scripts/cron-runner.js uptime
 */
const { spawn } = require("child_process");

const script = process.argv[2];
if (!script || !["metrics", "uptime"].includes(script)) {
  console.error("Usage: cron-runner.js {metrics|uptime}");
  process.exit(1);
}

const file = script === "metrics" ? "collect-metrics" : "uptime-check";
const child = spawn("./node_modules/.bin/tsx", [`scripts/${file}.ts`], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" }
});

child.on("exit", (code) => process.exit(code ?? 0));
