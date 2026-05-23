import { programAdminQuerySchema } from './joi.program-admin-query.schema';
import { programQuerySchema } from './joi.program-query.schema';

describe('Program Joi admin/public list query validation', () => {
  it('allows admin query without domainId', () => {
    const { error, value } = programAdminQuerySchema.validate({});

    expect(error).toBeUndefined();
    expect(value.limit).toBe(20);
    expect(value.offset).toBe(0);
  });

  it('keeps public query strict by requiring domainId', () => {
    const { error } = programQuerySchema.validate({});

    expect(error).toBeDefined();
  });
});
