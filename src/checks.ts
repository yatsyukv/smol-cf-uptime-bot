import type { Check } from './types.ts';

/** Adding a project = adding one line. */
export const CHECKS: Check[] = [
  { name: 'events', url: 'https://events.winwin.education/healthz' },
  { name: 'website', url: 'https://www.winwin.education/healthz' },
  { name: 'core', url: 'https://api.winwin.education/healthz' },
];
