import { ServiceUnavailableException } from '@nestjs/common';
import {
  ScanSemaphore,
  RandomScanUnavailableException,
  processRandomScans,
  previewRandomScans,
  selectRandomDocuments,
  permuteItems,
} from './ranked-query';

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
function cursor(rows: Array<{ _id: string }>) {
  return {
    async *[Symbol.asyncIterator]() {
      yield* rows;
    },
    close: jest.fn(async () => undefined),
  };
}

describe('bounded Random query execution', () => {
  it.each([0, 4, 20])('handles %i candidates against K=4', async (count) => {
    const rows = Array.from({ length: count }, (_, i) => ({ _id: String(i) }));
    const source = cursor(rows);
    expect(await selectRandomDocuments(() => source, 4, { seed: 's' })).toEqual(
      permuteItems(rows, 's', (row) => row._id).slice(0, 4),
    );
    expect(source.close).toHaveBeenCalledTimes(1);
  });
  it('bounds process concurrency across independent callers', async () => {
    const budget = new ScanSemaphore(2, 64, 1000);
    let active = 0,
      maximum = 0;
    await Promise.all(
      Array.from({ length: 12 }, () =>
        selectRandomDocuments(
          () => ({
            async *[Symbol.asyncIterator]() {
              maximum = Math.max(maximum, ++active);
              await delay(5);
              yield { _id: 'a' };
            },
            async close() {
              active--;
            },
          }),
          1,
          { seed: 's' },
          budget,
        ),
      ),
    );
    expect(maximum).toBe(2);
    expect(active).toBe(0);
  });
  it('rejects queue overflow and times out waiting without leaking slots', async () => {
    const budget = new ScanSemaphore(1, 1, 10);
    let finish: () => void;
    const active = budget.run(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const waiting = expect(
      budget.run(async () => 'queued'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(budget.run(async () => 'overflow')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await waiting;
    finish();
    await active;
    await expect(budget.run(async () => 'released')).resolves.toBe('released');
  });
  it('times out stalled cursor reads, closes once and releases the slot', async () => {
    const budget = new ScanSemaphore(1);
    const close = jest.fn(async () => undefined);
    await expect(
      selectRandomDocuments(
        () => ({
          [Symbol.asyncIterator]() {
            return {
              next: () =>
                new Promise<IteratorResult<{ _id: string }>>(() => undefined),
            };
          },
          close,
        }),
        1,
        { seed: 's' },
        budget,
        10,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(close).toHaveBeenCalledTimes(1);
    await expect(budget.run(async () => 'released')).resolves.toBe('released');
  });
  it('maps MongoDB timeouts to retryable 503 without partial results', async () => {
    await expect(
      selectRandomDocuments(
        () => ({
          async *[Symbol.asyncIterator]() {
            yield { _id: 'a' };
            throw Object.assign(new Error('time limit'), { code: 50 });
          },
          async close() {
            return undefined;
          },
        }),
        2,
        { seed: 's' },
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('preserves timeout status and releases admission when cursor cleanup fails', async () => {
    const budget = new ScanSemaphore(1);
    const close = jest.fn(async () => {
      throw new Error('cleanup failed');
    });
    await expect(
      selectRandomDocuments(
        () => ({
          async *[Symbol.asyncIterator]() {
            yield { _id: 'a' };
            throw Object.assign(new Error('time limit'), { code: 50 });
          },
          close,
        }),
        2,
        { seed: 's' },
        budget,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(close).toHaveBeenCalledTimes(1);
    await expect(budget.run(async () => 'released')).resolves.toBe('released');
  });
});

it('retains complete results and releases admission when successful cursor cleanup rejects', async () => {
  const budget = new ScanSemaphore(1);
  const source = cursor([{ _id: 'a' }, { _id: 'b' }]);
  source.close.mockRejectedValue(new Error('close failed'));
  await expect(
    selectRandomDocuments(() => source, 2, { seed: 's' }, budget),
  ).resolves.toHaveLength(2);
  expect(source.close).toHaveBeenCalledTimes(1);
  await expect(budget.run(async () => 'released')).resolves.toBe('released');
});

it('keeps a saturated preview queue independent of both public slots', async () => {
  let releasePreview: () => void;
  let releasePublic: () => void;
  const previewGate = new Promise<void>((resolve) => {
    releasePreview = resolve;
  });
  const publicGate = new Promise<void>((resolve) => {
    releasePublic = resolve;
  });
  let publicActive = 0,
    previewActive = 0,
    publicMaximum = 0,
    previewMaximum = 0;
  const previews = Array.from({ length: 65 }, () =>
    previewRandomScans.run(async () => {
      previewMaximum = Math.max(previewMaximum, ++previewActive);
      await previewGate;
      previewActive--;
    }),
  );
  try {
    await expect(
      previewRandomScans.run(async () => undefined),
    ).rejects.toMatchObject({ reason: 'queue_full' });
    const publics = Array.from({ length: 2 }, () =>
      processRandomScans.run(async () => {
        publicMaximum = Math.max(publicMaximum, ++publicActive);
        await publicGate;
        publicActive--;
      }),
    );
    expect(publicActive).toBe(2);
    expect(previewActive).toBe(1);
    releasePublic();
    await Promise.all(publics);
  } finally {
    releasePreview();
    await Promise.all(previews);
  }
  expect(publicMaximum).toBe(2);
  expect(previewMaximum).toBe(1);
});

it('identifies admission timeout separately and cleans the timed-out waiter', async () => {
  const budget = new ScanSemaphore(1, 64, 5);
  let release: () => void;
  const active = budget.run(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  await expect(budget.run(async () => undefined)).rejects.toMatchObject({
    reason: 'queue_timeout',
  });
  release();
  await active;
  expect(new RandomScanUnavailableException('scan_timeout').getStatus()).toBe(
    503,
  );
  await expect(budget.run(async () => 'released')).resolves.toBe('released');
});

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('preview cancellation admission', () => {
  it('rejects before enqueue without running work', async () => {
    const controller = new AbortController();
    controller.abort();
    const work = jest.fn(async () => undefined);
    await expect(
      new ScanSemaphore(1).run(work, controller.signal),
    ).rejects.toBe(controller.signal.reason);
    expect(work).not.toHaveBeenCalled();
  });

  it('removes cancelled waiters and listeners so queue capacity can be reused', async () => {
    const budget = new ScanSemaphore(1, 1, 1000);
    const gate = deferred();
    const first = budget.run(() => gate.promise);
    const controller = new AbortController();
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    const work = jest.fn(async () => 'cancelled');
    const reason = new Error('cancelled waiter');
    const cancelled = expect(budget.run(work, controller.signal)).rejects.toBe(
      reason,
    );
    controller.abort(reason);
    await cancelled;
    const next = budget.run(async () => 'next');
    gate.resolve();
    await first;
    expect(await next).toBe('next');
    expect(work).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('returns an admitted slot exactly once if cancellation wins the handoff race', async () => {
    const budget = new ScanSemaphore(1, 2, 1000);
    const gate = deferred();
    const first = budget.run(() => gate.promise);
    const controller = new AbortController();
    const reason = new Error('cancelled at handoff');
    const work = jest.fn(async () => undefined);
    const cancelled = expect(budget.run(work, controller.signal)).rejects.toBe(
      reason,
    );
    const nextGate = deferred();
    const nextWork = jest.fn(() => nextGate.promise);
    const next = budget.run(nextWork);
    gate.resolve();
    queueMicrotask(() => controller.abort(reason));
    await first;
    await cancelled;
    expect(work).not.toHaveBeenCalled();
    expect(nextWork).toHaveBeenCalledTimes(1);
    const lastWork = jest.fn(async () => 'last');
    const last = budget.run(lastWork);
    expect(lastWork).not.toHaveBeenCalled();
    nextGate.resolve();
    await next;
    expect(await last).toBe('last');
  });

  it('public admission waits one second while preview admission remains independent', async () => {
    jest.useFakeTimers();
    const gate = deferred();
    const running = [
      processRandomScans.run(() => gate.promise),
      processRandomScans.run(() => gate.promise),
    ];
    const work = jest.fn(async () => undefined);
    const waiting = expect(processRandomScans.run(work)).rejects.toMatchObject({
      reason: 'queue_timeout',
    });
    try {
      await jest.advanceTimersByTimeAsync(999);
      expect(work).not.toHaveBeenCalled();
      await expect(previewRandomScans.run(async () => 'preview')).resolves.toBe(
        'preview',
      );
      await jest.advanceTimersByTimeAsync(1);
      await waiting;
    } finally {
      gate.resolve();
      await Promise.all(running);
      jest.useRealTimers();
    }
  });
});

describe('preview cursor cancellation', () => {
  it('cancels stalled reads, closes once, and keeps admission until cleanup settles', async () => {
    const budget = new ScanSemaphore(1, 1, 1000);
    const controller = new AbortController();
    const started = deferred();
    const cleanup = deferred();
    const close = jest.fn(() => cleanup.promise);
    const source = {
      [Symbol.asyncIterator]: () => ({
        next: () => {
          started.resolve();
          return new Promise<IteratorResult<{ _id: string }>>(() => undefined);
        },
      }),
      close,
    };
    const reason = new Error('preview abandoned');
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    const scan = expect(
      selectRandomDocuments(
        () => source,
        2,
        { seed: 'cancel' },
        budget,
        1000,
        controller.signal,
      ),
    ).rejects.toBe(reason);
    await started.promise;
    controller.abort(reason);
    const work = jest.fn(async () => 'next');
    const next = budget.run(work);
    await Promise.resolve();
    expect(close).toHaveBeenCalledTimes(1);
    expect(work).not.toHaveBeenCalled();
    cleanup.resolve();
    await scan;
    expect(await next).toBe('next');
    expect(close).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('preserves cancellation when closing rejects and does not return partial rows', async () => {
    const controller = new AbortController();
    const reason = new Error('cancel');
    const close = jest.fn(async () => {
      throw new Error('cleanup');
    });
    const source = {
      async *[Symbol.asyncIterator]() {
        yield { _id: 'a' };
        controller.abort(reason);
        yield { _id: 'b' };
      },
      close,
    };
    await expect(
      selectRandomDocuments(
        () => source,
        2,
        { seed: 's' },
        new ScanSemaphore(1),
        1000,
        controller.signal,
      ),
    ).rejects.toBe(reason);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('does not cancel a completed scan while cleanup is pending or after completion', async () => {
    const controller = new AbortController();
    const startedCleanup = deferred();
    const cleanup = deferred();
    const source = cursor([{ _id: 'a' }]);
    source.close.mockImplementation(async () => {
      startedCleanup.resolve();
      await cleanup.promise;
    });
    const result = selectRandomDocuments(
      () => source,
      1,
      { seed: 's' },
      new ScanSemaphore(1),
      1000,
      controller.signal,
    );
    await startedCleanup.promise;
    controller.abort();
    cleanup.resolve();
    expect(await result).toEqual([{ _id: 'a' }]);
    controller.abort();
    expect(source.close).toHaveBeenCalledTimes(1);
  });
});
