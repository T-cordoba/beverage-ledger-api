import { expect } from 'chai';
import type { ApiResponse } from '../../api/support/api-test-app';

const ERROR_KEYS = ['error', 'message', 'path', 'statusCode', 'timestamp'];

/** The AllExceptionsFilter contract and nothing that would tell an attacker how the API is built. */
export function expectSafeError(response: ApiResponse, status: number): void {
  const text = response.raw.toString('utf8');

  expect(response.status, 'status').to.equal(status);
  expect(Object.keys(response.body).sort(), 'error keys').to.deep.equal(ERROR_KEYS);
  expect(response.body.statusCode, 'statusCode').to.equal(status);
  expect(text, 'stack property').not.to.match(/"stack"\s*:/);
  expect(text, 'stack frames').not.to.match(/\s+at\s.+\(.+:\d+:\d+\)/);
  expect(text, 'source paths').not.to.match(/node_modules|[\\/]src[\\/]/);
  expect(text, 'database internals').not.to.match(/prisma|postgres|organization_id/i);
}
