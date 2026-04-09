import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { Schema, model, models } from 'mongoose';
import { TimezoneInterceptor } from './timezone.interceptor';

describe('TimezoneInterceptor', () => {
  const interceptor = new TimezoneInterceptor();

  const makeContext = (timeZone?: string): ExecutionContext =>
    ({
      getType: jest.fn().mockReturnValue('http'),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => ({
          user: timeZone ? { timeZone } : undefined,
        }),
      }),
    } as unknown as ExecutionContext);

  it('converts only createdAt/updatedAt and leaves other dates unchanged', async () => {
    const payloadDate = new Date('2026-04-09T10:00:00.000Z');
    const response = {
      createdAt: payloadDate,
      updatedAt: payloadDate,
      startAt: payloadDate,
      nested: {
        createdAt: payloadDate,
        date: payloadDate,
      },
    };

    const handler: CallHandler = {
      handle: () => of(response),
    };

    const result = (await lastValueFrom(
      interceptor.intercept(makeContext('+04:00'), handler),
    )) as Record<string, unknown>;

    expect(result.createdAt).toBe('2026-04-09T14:00:00.000+04:00');
    expect(result.updatedAt).toBe('2026-04-09T14:00:00.000+04:00');
    expect(result.startAt).toBe(payloadDate);

    const nested = result.nested as Record<string, unknown>;
    expect(nested.createdAt).toBe('2026-04-09T14:00:00.000+04:00');
    expect(nested.date).toBe(payloadDate);
  });

  it('converts nested timestamp keys in arrays', async () => {
    const response = {
      items: [
        { createdAt: '2026-04-09T10:00:00.000Z' },
        { updatedAt: new Date('2026-04-09T11:00:00.000Z') },
        { other: 'value' },
      ],
    };

    const handler: CallHandler = {
      handle: () => of(response),
    };

    const result = (await lastValueFrom(
      interceptor.intercept(makeContext('+04:00'), handler),
    )) as { items: Array<Record<string, unknown>> };

    expect(result.items[0].createdAt).toBe('2026-04-09T14:00:00.000+04:00');
    expect(result.items[1].updatedAt).toBe('2026-04-09T15:00:00.000+04:00');
    expect(result.items[2].other).toBe('value');
  });

  it('serializes mongoose document before conversion and does not leak internals', async () => {
    const schema = new Schema({ name: String }, { timestamps: true });
    const modelName = 'TimezoneInterceptorTestModel';
    const TestModel =
      models[modelName] || model(modelName, schema, 'tz_interceptor_tests');

    const doc = new TestModel({ name: 'Alice' });
    doc.createdAt = new Date('2026-04-09T10:00:00.000Z');
    doc.updatedAt = new Date('2026-04-09T11:00:00.000Z');

    const handler: CallHandler = {
      handle: () => of(doc),
    };

    const result = (await lastValueFrom(
      interceptor.intercept(makeContext('+04:00'), handler),
    )) as Record<string, unknown>;

    expect(result).not.toHaveProperty('$__');
    expect(result).not.toHaveProperty('_doc');
    expect(result.name).toBe('Alice');
    expect(result.createdAt).toBe('2026-04-09T14:00:00.000+04:00');
    expect(result.updatedAt).toBe('2026-04-09T15:00:00.000+04:00');
  });

  it('returns response unchanged when timezone is missing', async () => {
    const response = { createdAt: new Date('2026-04-09T10:00:00.000Z') };

    const handler: CallHandler = {
      handle: () => of(response),
    };

    const result = await lastValueFrom(
      interceptor.intercept(makeContext(undefined), handler),
    );

    expect(result).toBe(response);
  });
});
