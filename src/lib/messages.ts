import type { CommandId } from './commands';

export const MESSAGES = {
  toggleReader: 'driftless/toggle-reader',
  runCommand: 'driftless/run-command',
  openOptions: 'driftless/open-options',
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

export type ExtensionMessage = ActivateMessage | RunCommandMessage | OpenOptionsMessage;

export interface ActivateResponse {
  ok: boolean;
  error?: string;
}
