import mongoose from 'mongoose';
import { auditPageDocuments } from './page-validation-audit';

async function* documents() {
  yield { _id: 'valid', title: 'Valid' };
  yield { _id: 'invalid', title: 'private-title' };
}

describe('page validation audit', () => {
  it('reports only ids and sorted validation paths without document values', async () => {
    const summary = await auditPageDocuments(documents(), (document) => {
      if (document._id === 'valid') {
        return undefined;
      }

      const error = new mongoose.Error.ValidationError();
      error.addError(
        'title',
        new mongoose.Error.ValidatorError({
          path: 'title',
          value: document.title,
        }),
      );
      error.addError(
        'blocks.0.columns',
        new mongoose.Error.ValidatorError({
          path: 'blocks.0.columns',
          value: 'private-columns',
        }),
      );
      return error;
    });

    expect(summary).toEqual({
      checkedPages: 2,
      invalidPages: 1,
      failures: [
        {
          _id: 'invalid',
          paths: ['blocks.0.columns', 'title'],
        },
      ],
    });
    expect(JSON.stringify(summary)).not.toContain('private');
  });
});
