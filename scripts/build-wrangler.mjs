import { readFileSync, writeFileSync } from 'node:fs';

const root = process.env.ROOT;
const out = process.env.DEPLOY_CONFIG;
const kvId = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
const checksPath = process.env.CHECKS_FILE;
if (!root || !out || !kvId || !checksPath) {
  console.error('ROOT, DEPLOY_CONFIG, CLOUDFLARE_KV_NAMESPACE_ID, CHECKS_FILE are required');
  process.exit(1);
}

const cfg = JSON.parse(readFileSync(`${root}/wrangler.jsonc`, 'utf8'));
const checks = JSON.parse(readFileSync(checksPath, 'utf8'));

cfg.name = process.env.WORKER_NAME || 'smol-cf-uptime';
cfg.kv_namespaces = [{ binding: 'STATE', id: kvId }];
cfg.vars = {
  CHECKS_JSON: JSON.stringify(checks),
  SUMMARY_TZ: process.env.SUMMARY_TZ || 'UTC',
  SUMMARY_HOUR: process.env.SUMMARY_HOUR || '9',
};

writeFileSync(out, `${JSON.stringify(cfg, null, 2)}\n`);
