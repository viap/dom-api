/** Synthetic measurements exercise production conversion, cache and scan admission. */
import { benchmarkCollection } from './entity-collection-benchmark';
async function main() {
  for (const candidateCount of [1000, 10000, 50000]) {
    const rows = Array.from({ length: candidateCount }, (_, index) => ({
      _id: index.toString(16).padStart(24, '0'),
      fullName: `Candidate ${index}`,
    }));
    await benchmarkCollection(
      candidateCount,
      () => ({
        async *[Symbol.asyncIterator]() {
          yield* rows;
        },
        async close() {
          return undefined;
        },
      }),
      async (limit) => rows.slice(0, limit),
      {
        kind: 'synthetic',
        queryFilter: { isPublished: true },
        explainExecutionStats: null,
        docsExamined: null,
        note: 'Generated cursor; no database evidence or production-like acceptance.',
      },
    );
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
