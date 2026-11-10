import { chmodSync, writeFileSync } from 'node:fs';

const path = process.env.ENV_FILE;
if (!path) {
  console.error('ENV_FILE is required');
  process.exit(1);
}

const keys = [
  'CLOUDFLARE_API_TOKEN',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_KV_NAMESPACE_ID',
  'WORKER_NAME',
  'SUMMARY_TZ',
  'SUMMARY_HOUR',
];

function quote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

const lines = [];
for (const key of keys) {
  const value = process.env[key];
  if (value == null || value === '') continue;
  lines.push(`${key}=${quote(value)}`);
}

writeFileSync(path, `${lines.join('\n')}\n`, { encoding: 'utf8' });
chmodSync(path, 0o600);
