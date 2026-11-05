import type { CommandId } from './commands';

export const MESSAGES = {
  toggleReader: 'driftless/toggle-reader',
  runCommand: 'driftless/run-command',
  openOptions: 'driftless/open-options',
  getFont: 'driftless/get-font',
} as const;

export interface ActivateMessage {
  type: typeof MESSAGES.toggleReader;
  tabId: number;
}

export interface RunCommandMessage {
  type: typeof MESSAGES.runCommand;
  tabId: number;
  command: CommandId;
}

export interface OpenOptionsMessage {
  type: typeof MESSAGES.openOptions;
}

export interface GetFontMessage {
  type: typeof MESSAGES.getFont;
  /** One of the bundled font files, e.g. "fonts/lexend-latin-wght-normal.woff2". */
  file: string;
}

export interface GetFontResponse {
  ok: boolean;
  /** Base64-encoded font bytes. */
  data?: string;
}

export type ExtensionMessage =
  ActivateMessage | RunCommandMessage | OpenOptionsMessage | GetFontMessage;

export interface ActivateResponse {
  ok: boolean;
  error?: string;
}
