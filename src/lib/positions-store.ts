import { storage } from 'wxt/utils/storage';
import { DEFAULT_WPM } from './reading-time';
import { WPM_RANGE } from './anchor-tracker';
import { privateId } from './hash';

/**
 * Where you were in an article. Stored locally, per page.
 *
 * Privacy: the page is identified by a one-way hash of its URL, and the
 * anchor paragraph by a hash of its first words, so local storage never
 * holds readable browsing history or page text.
 */
export interface SavedPosition {
  /** Index of the anchor block. */
  anchor: number;
  /** Hash of the anchor block's opening text, to re-find it if the page changed. */
  fingerprint: string;
  totalBlocks: number;
  percent: number;
  updatedAt: number;
}

type PositionMap = Record<string, SavedPosition>;

/** Keep storage small: only the most recently read pages are remembered. */
export const MAX_SAVED_PAGES = 200;

// "V2": hashed keys. Older plain-URL data ('positions') is removed on update.
const positionsItem = storage.defineItem<PositionMap>('local:positionsV2', { fallback: {} });
const speedItem = storage.defineItem<number>('local:readingSpeed', { fallback: DEFAULT_WPM });

export function prunePositions(map: PositionMap, max = MAX_SAVED_PAGES): PositionMap {
  const entries = Object.entries(map);
  if (entries.length <= max) return map;
  entries.sort(([, a], [, b]) => b.updatedAt - a.updatedAt);
  return Object.fromEntries(entries.slice(0, max));
}

/** Storage key for a page: a hash, so stored keys don't reveal the URL. */
export const positionKey = (pageKey: string) => privateId(`page:${pageKey}`);

export async function loadPosition(pageKey: string): Promise<SavedPosition | null> {
  const map = await positionsItem.getValue();
  return map[positionKey(pageKey)] ?? null;
}

export async function savePosition(pageKey: string, position: SavedPosition): Promise<void> {
  const map = await positionsItem.getValue();
  await positionsItem.setValue(prunePositions({ ...map, [positionKey(pageKey)]: position }));
}

export async function clearPosition(pageKey: string): Promise<void> {
  const map = { ...(await positionsItem.getValue()) };
  delete map[positionKey(pageKey)];
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

/** How many articles have a saved position. */
export async function countPositions(): Promise<number> {
  return Object.keys(await positionsItem.getValue()).length;
}

/** Forgets every saved reading position. */
export async function clearAllPositions(): Promise<void> {
  await positionsItem.setValue({});
}

/** Forgets the learned reading speed (back to the average). */
export async function resetReadingSpeed(): Promise<void> {
  await speedItem.removeValue();
}
