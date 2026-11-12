import type { Request, Response } from 'express';

export async function withRequestCancellation<T>(
  request: Request,
  response: Response,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T | undefined> {
  const cancellation = new AbortController();
  const abort = () => cancellation.abort();
  const close = () => {
    if (!response.writableEnded) abort();
  };

  request.once('aborted', abort);
  response.once('close', close);
  if (request.aborted || response.destroyed) abort();

  try {
    return await operation(cancellation.signal);
  } catch (error) {
    // A disconnected client cannot receive an error response. Do not turn its
    // cancellation into overload or an internal-server-error response.
    if (cancellation.signal.aborted && error === cancellation.signal.reason) {
      return undefined;
    }
    throw error;
  } finally {
    request.removeListener('aborted', abort);
    response.removeListener('close', close);
  }
}
