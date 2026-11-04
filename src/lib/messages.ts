export const MESSAGES = {
  toggleReader: 'driftless/toggle-reader',
} as const;

export interface ActivateMessage {
  type: typeof MESSAGES.toggleReader;
  tabId: number;
}

export interface ActivateResponse {
  ok: boolean;
  error?: string;
}
