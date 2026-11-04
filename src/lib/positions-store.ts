import { storage } from 'wxt/utils/storage';
import { DEFAULT_WPM } from './reading-time';
import { WPM_RANGE } from './anchor-tracker';

/** Where you were in an article. Stored locally, per page. */
export interface SavedPosition {
  /** Index of the anchor block. */
  anchor: number;
  /** Start of the anchor block's text, to re-find it if the page changed. */
  fingerprint: string;
  totalBlocks: number;
  percent: number;
  updatedAt: number;
}

type PositionMap = Record<string, SavedPosition>;

/** Keep storage small: only the most recently read pages are remembered. */
export const MAX_SAVED_PAGES = 200;

const positionsItem = storage.defineItem<PositionMap>('local:positions', { fallback: {} });
const speedItem = storage.defineItem<number>('local:readingSpeed', { fallback: DEFAULT_WPM });

export function prunePositions(map: PositionMap, max = MAX_SAVED_PAGES): PositionMap {
  const entries = Object.entries(map);
  if (entries.length <= max) return map;
  entries.sort(([, a], [, b]) => b.updatedAt - a.updatedAt);
  return Object.fromEntries(entries.slice(0, max));
}

export async function loadPosition(key: string): Promise<SavedPosition | null> {
  const map = await positionsItem.getValue();
  return map[key] ?? null;
}

export async function savePosition(key: string, position: SavedPosition): Promise<void> {
  const map = await positionsItem.getValue();
  await positionsItem.setValue(prunePositions({ ...map, [key]: position }));
}

export async function clearPosition(key: string): Promise<void> {
  const map = { ...(await positionsItem.getValue()) };
  delete map[key];
  await positionsItem.setValue(map);
}

export async function loadReadingSpeed(): Promise<number> {
  const value = await speedItem.getValue();
  return typeof value === 'number' && value >= WPM_RANGE.min && value <= WPM_RANGE.max
    ? value
    : DEFAULT_WPM;
}

export async function saveReadingSpeed(wpm: number): Promise<void> {
  await speedItem.setValue(Math.round(wpm));
}
