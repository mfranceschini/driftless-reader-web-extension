/** Keyboard commands (customizable in the browser's extension shortcuts page). */
export const COMMANDS = {
  toggleReader: 'toggle-reader',
  readAloud: 'read-aloud',
  focusBand: 'focus-band',
  chunkMode: 'chunk-mode',
} as const;

export type CommandId = (typeof COMMANDS)[keyof typeof COMMANDS];

/** Commands that act inside an open reader (vs. opening/closing it). */
export type ReaderCommand = Exclude<CommandId, 'toggle-reader'>;

export const COMMAND_LABELS: Record<CommandId, string> = {
  'toggle-reader': 'Start or stop Driftless Reader on this page',
  'read-aloud': 'Read aloud: start, pause or resume',
  'focus-band': 'Turn the focus band on or off',
  'chunk-mode': 'Turn Chunk mode on or off',
};

export function isReaderCommand(value: unknown): value is ReaderCommand {
  return value === 'read-aloud' || value === 'focus-band' || value === 'chunk-mode';
}

/** The browser's own page for changing extension shortcuts. */
export function shortcutsPageUrl(userAgent: string = navigator.userAgent): string {
  return /\bEdg\//.test(userAgent)
    ? 'edge://extensions/shortcuts'
    : 'chrome://extensions/shortcuts';
}
