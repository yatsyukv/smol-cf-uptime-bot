import { readFileSync } from 'node:fs';
import { parseChecks } from '../src/checks.ts';
import { statusMessage, stripHtml } from '../src/messages.ts';
import { parseState } from '../src/persist.ts';

const checksFile = process.env.CHECKS_FILE;
if (!checksFile) {
  console.error('CHECKS_FILE is required');
  process.exit(1);
}

const checks = parseChecks(readFileSync(checksFile, 'utf8'));
const raw = (process.env.STATE_JSON ?? '').trim();
const missing =
  raw === '' ||
  raw === 'Value not found' ||
  raw.startsWith('✘') ||
  raw.toLowerCase().includes('not found');
const state = parseState(missing ? null : raw);
process.stdout.write(`${stripHtml(statusMessage(state, checks, new Date()))}\n`);
