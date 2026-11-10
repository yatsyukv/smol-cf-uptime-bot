export type Check = {
  name: string;
  url: string;
};

export type CheckResult = {
  name: string;
  url: string;
  ok: boolean;
  reason?: string;
};

export type CheckStatus = 'up' | 'down';

export type CheckState = {
  status: CheckStatus;
  fails: number;
  downSince: string | null;
  lastAlertAt: string | null;
};

export type State = {
  lastSummaryDate: string | null;
  [name: string]: CheckState | string | null;
};

export type MessageKind = 'down' | 'up' | 'reminder' | 'summary';

export type Message = {
  kind: MessageKind;
  name?: string;
  text: string;
};

export type StepOptions = {
  tz?: string;
  summaryHour?: number;
};
