import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { FilterQuery, Model, SortOrder } from 'mongoose';

import {
  RANDOM_PUBLIC_SCAN_CONCURRENCY,
  RANDOM_PREVIEW_SCAN_CONCURRENCY,
  RANDOM_PUBLIC_QUEUE_TIMEOUT_MS,
  RANDOM_PREVIEW_QUEUE_TIMEOUT_MS,
  RANDOM_SCAN_MAX_WAITING,
  RANDOM_SCAN_TIMEOUT_MS,
} from '@/common/constants/random-selection.constants';

export { RANDOM_SCAN_TIMEOUT_MS } from '@/common/constants/random-selection.constants';
const logger = new Logger('RandomSelection');
export interface RandomOrdering {
  seed: string;
}
export type RandomScanFailureReason =
  | 'queue_full'
  | 'queue_timeout'
  | 'scan_timeout'
  | 'mongo_timeout';

/** Only this failure permits a public Dynamic block to retry with Default. */
export class RandomScanUnavailableException extends ServiceUnavailableException {
  constructor(readonly reason: RandomScanFailureReason) {
    super('Random selection is busy or timed out; retry the request');
  }
}
const unavailable = (reason: RandomScanFailureReason) =>
  new RandomScanUnavailableException(reason);

/** Process admission stays separate from deterministic ordering identity. */
export class ScanSemaphore {
  private active = 0;
  private readonly waiting: Array<{
    start: () => void;
  }> = [];
  constructor(
    private readonly maximum = 2,
    private readonly maximumWaiting = Infinity,
    private readonly waitMs = 0,
  ) {
    if (!Number.isInteger(maximum) || maximum < 1)
      throw new Error('Invalid scan concurrency');
  }
  async run<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted();
    if (this.active >= this.maximum) {
      if (this.waiting.length >= this.maximumWaiting) {
        throw unavailable('queue_full');
      }
      await new Promise<void>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const cleanup = () => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', abort);
        };
        const rejectWaiting = (error: unknown) => {
          const index = this.waiting.indexOf(entry);
          if (index < 0) return; // Already admitted; the slot belongs to this run.
          this.waiting.splice(index, 1);
          cleanup();
          reject(error);
        };
        const abort = () => rejectWaiting(signal?.reason);
        const entry = {
          start: () => {
            cleanup();
            resolve();
          },
        };
        if (this.waitMs)
          timer = setTimeout(
            () => rejectWaiting(unavailable('queue_timeout')),
            this.waitMs,
          );
        this.waiting.push(entry);
        signal?.addEventListener('abort', abort, { once: true });
      });
    } else this.active++;
    try {
      signal?.throwIfAborted();
      return await work();
    } finally {
      const next = this.waiting.shift();
      if (next) {
        next.start();
      } else this.active--;
    }
  }
}

export const processRandomScans = new ScanSemaphore(
  RANDOM_PUBLIC_SCAN_CONCURRENCY,
  RANDOM_SCAN_MAX_WAITING,
  RANDOM_PUBLIC_QUEUE_TIMEOUT_MS,
);
export const previewRandomScans = new ScanSemaphore(
  RANDOM_PREVIEW_SCAN_CONCURRENCY,
  RANDOM_SCAN_MAX_WAITING,
  RANDOM_PREVIEW_QUEUE_TIMEOUT_MS,
);

export function candidateRank(seed: string, key: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify([seed, key]))
    .digest('hex');
}

type Ranked<T> = { value: T; rank: string; key: string };
function compare<T>(left: Ranked<T>, right: Ranked<T>): number {
  return left.rank < right.rank
    ? -1
    : left.rank > right.rank
    ? 1
    : left.key < right.key
    ? -1
    : left.key > right.key
    ? 1
    : 0;
}

export function permuteItems<T>(
  items: readonly T[],
  seed: string,
  key: (item: T, index: number) => unknown,
): T[] {
  return items
    .map((value, index) => {
      const candidate = key(value, index);
      return {
        value,
        rank: candidateRank(seed, candidate),
        key: JSON.stringify(candidate),
      };
    })
    .sort(compare)
    .map(({ value }) => value);
}

/** Max heap retains only K projected documents; O(N log K) time, O(K) space. */
export class RankedTopK<T> {
  private readonly heap: Ranked<T>[] = [];
  constructor(private readonly limit: number, private readonly seed: string) {
    if (!Number.isInteger(limit) || limit < 1)
      throw new Error('Invalid selection limit');
  }
  add(value: T, candidate: unknown): void {
    const entry = {
      value,
      rank: candidateRank(this.seed, candidate),
      key: JSON.stringify(candidate),
    };
    const heap = this.heap;
    if (heap.length < this.limit) {
      heap.push(entry);
      let index = heap.length - 1;
      while (index > 0) {
        const parent = (index - 1) >> 1;
        if (compare(heap[parent], heap[index]) >= 0) break;
        [heap[parent], heap[index]] = [heap[index], heap[parent]];
        index = parent;
      }
    } else if (compare(entry, heap[0]) < 0) {
      heap[0] = entry;
      let index = 0;
      while (index * 2 + 1 < heap.length) {
        let child = index * 2 + 1;
        if (
          child + 1 < heap.length &&
          compare(heap[child + 1], heap[child]) > 0
        )
          child++;
        if (compare(heap[index], heap[child]) >= 0) break;
        [heap[index], heap[child]] = [heap[child], heap[index]];
        index = child;
      }
    }
  }
  values(): T[] {
    return [...this.heap].sort(compare).map(({ value }) => value);
  }
}

export async function selectRandomDocuments<
  T extends { _id: { toString(): string } },
>(
  cursorFactory: () => AsyncIterable<T> & { close?: () => Promise<void> },
  limit: number,
  ordering: RandomOrdering,
  budget = processRandomScans,
  timeoutMs = RANDOM_SCAN_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<T[]> {
  return budget.run(async () => {
    const start = performance.now();
    const cursor = cursorFactory();
    let count = 0;
    let timedOut = false;
    let closing: Promise<void> | undefined;
    const close = () =>
      (closing ??= Promise.resolve().then(() => cursor.close?.()));
    let rejectRead: ((error: Error) => void) | undefined;
    const abort = () => {
      rejectRead?.(signal?.reason);
      void close().catch(() => undefined);
    };
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      rejectRead?.(unavailable('scan_timeout'));
      void close().catch(() => undefined);
    }, timeoutMs);
    try {
      signal?.throwIfAborted();
      const selected = new RankedTopK<T>(limit, ordering.seed);
      const iterator = cursor[Symbol.asyncIterator]();
      while (true) {
        signal?.throwIfAborted();
        if (timedOut || performance.now() - start >= timeoutMs)
          throw unavailable('scan_timeout');
        const next = await new Promise<IteratorResult<T>>((resolve, reject) => {
          rejectRead = reject;
          Promise.resolve()
            .then(() => {
              signal?.throwIfAborted();
              return iterator.next();
            })
            .then(resolve, reject);
        });
        rejectRead = undefined;
        signal?.throwIfAborted();
        if (next.done) break;
        const document = next.value;
        if (timedOut || performance.now() - start >= timeoutMs)
          throw unavailable('scan_timeout');
        selected.add(document, document._id.toString());
        if (++count % 256 === 0)
          await new Promise<void>((resolve) => setImmediate(resolve));
      }
      if (timedOut || performance.now() - start >= timeoutMs)
        throw unavailable('scan_timeout');
      return selected.values();
    } catch (error) {
      if (signal?.aborted && error === signal.reason) throw error;
      if (timedOut) throw unavailable('scan_timeout');
      if ((error as { code?: number }).code === 50)
        throw unavailable('mongo_timeout');
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      try {
        await close();
      } catch {
        // Cleanup must not replace either a complete result or its original failure.
        logger.warn({ event: 'random_cursor_cleanup_failed' });
      }
      logger.debug({
        event: 'random_scan',
        documents: count,
        durationMs: Math.round(performance.now() - start),
        scanTimedOut: timedOut,
      });
    }
  }, signal);
}

/** One query path preserves projections and Default database ordering. */
export async function findRanked<T>(
  model: Model<T>,
  query: FilterQuery<T>,
  projection: Record<string, 1>,
  sort: Record<string, SortOrder>,
  limit: number,
  ordering?: RandomOrdering,
  purpose: 'public' | 'preview' = 'public',
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const find = () => model.find(query).select(projection).lean();
  const result = ordering
    ? await selectRandomDocuments(
        () => find().maxTimeMS(RANDOM_SCAN_TIMEOUT_MS).cursor(),
        limit,
        ordering,
        purpose === 'preview' ? previewRandomScans : processRandomScans,
        RANDOM_SCAN_TIMEOUT_MS,
        signal,
      )
    : await find().sort(sort).limit(limit).exec();
  signal?.throwIfAborted();
  return result;
}
