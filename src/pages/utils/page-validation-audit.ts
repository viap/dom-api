import { Connection } from 'mongoose';
import { getMongooseValidationErrorPaths } from '@/common/utils/mongoose-validation-error';
import { Page, pageSchema } from '../schemas/page.schema';

export type PageValidationAuditFailure = {
  _id: string;
  paths: string[];
};

export type PageValidationAuditSummary = {
  checkedPages: number;
  invalidPages: number;
  failures: PageValidationAuditFailure[];
};

export async function auditPageDocuments(
  documents: AsyncIterable<Record<string, unknown>>,
  validate: (document: Record<string, unknown>) => unknown,
): Promise<PageValidationAuditSummary> {
  const summary: PageValidationAuditSummary = {
    checkedPages: 0,
    invalidPages: 0,
    failures: [],
  };

  for await (const document of documents) {
    summary.checkedPages += 1;
    const error = validate(document);
    if (!error) {
      continue;
    }

    summary.invalidPages += 1;
    summary.failures.push({
      _id: String(document._id),
      paths: getMongooseValidationErrorPaths(error) ?? [],
    });
  }

  return summary;
}

export async function auditStoredPages(
  connection: Connection,
): Promise<PageValidationAuditSummary> {
  const PageModel = connection.model(Page.name, pageSchema, 'pages');
  const documents = connection.db.collection('pages').find({});

  return auditPageDocuments(documents, (document) => {
    try {
      return new PageModel(document).validateSync();
    } catch (error) {
      return error;
    }
  });
}
