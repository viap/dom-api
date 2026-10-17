import { performance } from 'node:perf_hooks';
import { randomBytes } from 'node:crypto';
import { Logger } from '@nestjs/common';
import {
  RankedTopK,
  type RandomOrdering,
  selectRandomDocuments,
} from '../src/common/utils/ranked-query';
import { createRandomOrdering } from '../src/pages/utils/entity-collection-ordering';
import {
  toPublicBlocks,
  PublicBlockServices,
} from '../src/pages/utils/block-validation';

type Row = { _id: { toString(): string }; title?: string; fullName?: string };
type Cursor = AsyncIterable<Row> & { close(): Promise<void> };

export async function benchmarkCollection(
  candidateCount: number,
  cursorFactory: () => Cursor,
  findDefault: (limit: number) => Promise<Row[]>,
  evidence: Record<string, unknown>,
  entityType = 'people',
) {
  Logger.overrideLogger(['error', 'warn']);
  for (const limit of [24, 100]) {
    const cpuCursor = cursorFactory();
    const top = new RankedTopK<Row>(limit, 'cpu');
    let topKCpuMs = 0;
    try {
      for await (const row of cpuCursor) {
        const start = performance.now();
        top.add(row, row._id.toString());
        topKCpuMs += performance.now() - start;
      }
    } finally {
      await cpuCursor.close();
    }
    for (const rootCount of [1, 5, 20]) {
      let active = 0,
        maximumActiveScans = 0,
        scans = 0,
        cursorDurationMs = 0,
        defaultQueries = 0;
      const completedSeeds = new Set<string>();
      const resolve = async (
        _: unknown,
        requestedLimit: number,
        ordering?: RandomOrdering,
      ) => {
        if (!ordering) {
          defaultQueries++;
          const rows = await findDefault(requestedLimit);
          return rows.map((row) => ({
            id: row._id.toString(),
            label: row.fullName ?? row.title ?? '',
          }));
        }
        const rows = await selectRandomDocuments(
          () => {
            scans++;
            maximumActiveScans = Math.max(maximumActiveScans, ++active);
            const start = performance.now(),
              cursor = cursorFactory();
            let closed = false;
            return {
              [Symbol.asyncIterator]: () => cursor[Symbol.asyncIterator](),
              async close() {
                if (closed) return;
                closed = true;
                try {
                  await cursor.close();
                } finally {
                  active--;
                  cursorDurationMs += performance.now() - start;
                }
              },
            };
          },
          requestedLimit,
          ordering,
        );
        completedSeeds.add(ordering.seed);
        return rows.map((row) => ({
          id: row._id.toString(),
          label: row.fullName ?? row.title ?? '',
        }));
      };
      const services: PublicBlockServices = {
        findPublishedPeopleSummariesByIds: async () => [],
        findDynamicPeopleSummaries: resolve,
        findDynamicPartnerSummaries: (filters, k, ordering) =>
          resolve(filters, k, ordering),
        findDynamicEventSummaries: (filters, k, context) =>
          resolve(filters, k, context.ordering),
      };
      const blocks = Array.from({ length: rootCount }, (_, index) => ({
        id: 'root-' + index,
        type: 'entityCollection',
        entityType,
        source: 'dynamic',
        layout: 'grid',
        items: [],
        filters: {},
        itemOrder: 'random',
        limit,
      }));
      const context = {
        now: new Date(),
        owner: {
          kind: 'page' as const,
          pageId: randomBytes(12).toString('hex'),
        },
      };
      const render = (selectedBlocks = blocks) =>
        toPublicBlocks(selectedBlocks, services, context);
      let start = performance.now();
      const cold = await render();
      const coldConversionMs = performance.now() - start;
      const coldScans = scans;
      const coldDefaultQueries = defaultQueries;
      const populated = blocks.filter((block) =>
        completedSeeds.has(
          createRandomOrdering(
            { ...context, blockPath: [block.id] },
            entityType,
          ).seed,
        ),
      );
      const populatedIds = new Set(populated.map((block) => block.id));
      start = performance.now();
      const warm = await render(populated);
      const warmConversionMs = performance.now() - start;
      const warmScans = scans - coldScans;
      const warmDefaultQueries = defaultQueries - coldDefaultQueries;
      context.owner = { kind: 'page', pageId: randomBytes(12).toString('hex') };
      const concurrentStartScans = scans;
      const concurrentStartDefaults = defaultQueries;
      start = performance.now();
      const concurrent = await Promise.all([render(), render(), render()]);
      const concurrentConversionMs = performance.now() - start;
      const concurrentScans = scans - concurrentStartScans;
      const concurrentDefaultQueries = defaultQueries - concurrentStartDefaults;
      if (
        maximumActiveScans > 2 ||
        active !== 0 ||
        warmScans !== 0 ||
        warmDefaultQueries !== 0 ||
        concurrentScans > rootCount ||
        populated.length + coldDefaultQueries !== rootCount ||
        JSON.stringify(
          cold.filter((block) => populatedIds.has(String(block.id))),
        ) !== JSON.stringify(warm) ||
        concurrent.some(
          (result) => JSON.stringify(result) !== JSON.stringify(concurrent[0]),
        )
      )
        throw new Error('Benchmark invariant failed');
      console.log(
        JSON.stringify({
          ...evidence,
          candidateCount,
          limit,
          rootCount,
          topKCpuMs,
          cursorDurationMs,
          coldConversionMs,
          warmConversionMs,
          concurrentConversionMs,
          coldScans,
          warmScans,
          concurrentScans,
          coldDefaultQueries,
          warmRootCount: populated.length,
          warmDefaultQueries,
          concurrentDefaultQueries,
          maximumActiveScans,
        }),
      );
    }
  }
}
