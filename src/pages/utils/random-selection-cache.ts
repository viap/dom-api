import { Logger } from '@nestjs/common';
import {
  PUBLIC_RANDOM_CACHE_TTL_MS,
  PUBLIC_RANDOM_CACHE_MAX_ENTRIES,
  PUBLIC_RANDOM_CACHE_MAX_BYTES,
} from '@/pages/constants/entity-collection.constants';

const logger = new Logger('RandomSelectionCache');
/** All array-valued filters are sets; block paths are encoded separately in seed. */
export function canonicalFilters(value: unknown): unknown {
  if (Array.isArray(value))
    return [
      ...new Set(value.map((item) => JSON.stringify(canonicalFilters(item)))),
    ]
      .sort()
      .map((item) => JSON.parse(item));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalFilters(item)]),
    );
  return value;
}

export class RandomSelectionCache {
  private readonly entries = new Map<
    string,
    { ids: string[]; expires: number; bytes: number }
  >();
  private readonly pending = new Map<string, Promise<string[]>>();
  private bytes = 0;
  constructor(
    private readonly clock = Date.now,
    private readonly maxEntries = PUBLIC_RANDOM_CACHE_MAX_ENTRIES,
    private readonly maxBytes = PUBLIC_RANDOM_CACHE_MAX_BYTES,
  ) {}
  private remove(key: string) {
    const entry = this.entries.get(key);
    if (entry) {
      this.bytes -= entry.bytes;
      this.entries.delete(key);
    }
  }
  async resolve(
    key: string,
    bucket: string,
    load: (scanStarted: () => void) => Promise<string[]>,
  ): Promise<string[]> {
    const now = this.clock();
    for (const [storedKey, entry] of this.entries)
      if (entry.expires <= now) this.remove(storedKey);
    const entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      this.entries.set(key, entry);
      return [...entry.ids];
    }
    const pending = this.pending.get(key);
    if (pending) {
      return [...(await pending)];
    }
    let started = now;
    const promise = Promise.resolve()
      .then(() =>
        load(() => {
          started = this.clock();
        }),
      )
      .then((result) => {
        const ids = [...result];
        const expires = Math.min(
          started + PUBLIC_RANDOM_CACHE_TTL_MS,
          Date.parse(bucket + 'T00:00:00.000Z') + 86_400_000,
        );
        const bytes = Buffer.byteLength(JSON.stringify([key, ids]), 'utf8');
        if (expires > this.clock() && bytes <= this.maxBytes) {
          while (
            this.entries.size >= this.maxEntries ||
            this.bytes + bytes > this.maxBytes
          ) {
            const oldest = this.entries.keys().next().value;
            if (oldest === undefined) break;
            this.remove(oldest);
          }
          this.entries.set(key, { ids, expires, bytes });
          this.bytes += bytes;
        }
        return ids;
      });
    this.pending.set(key, promise);
    try {
      return [...(await promise)];
    } finally {
      this.pending.delete(key);
      logger.debug({
        event: 'random_cache',
        entries: this.entries.size,
        bytes: this.bytes,
        pending: this.pending.size,
      });
    }
  }
}

/** Shared across Page/Event conversions in this process; previews never use it. */
export const publicRandomSelections = new RandomSelectionCache();
