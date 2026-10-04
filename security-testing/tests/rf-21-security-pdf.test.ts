import { PDFDocument } from 'pdf-lib';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  B_MOVEMENT,
  FAKE_PASSWORD_HASH,
  MovementType,
  MovementUnit,
  ORG_A,
  PRODUCTS,
  USERS,
} from '../support/fake-prisma';
import {
  createConfirmed,
  expectErrorShape,
  expectNoSensitiveData,
  expiredTokenFor,
  FAKE_DATABASE_URL,
  httpClient,
  isPdf,
  startSecurityTestApp,
  TEST_JWT_SECRET,
  tokenFor,
  tokenSignedWithWrongSecret,
  type HttpClient,
  type SecurityTestApp,
} from '../support/security-test-app';

/**
 * RF-21 - Download the movement voucher as PDF.
 *
 * GET /movements/:id/pdf serves a business document. Risks: downloading
 * another tenant's voucher (the original implementation had no check at all),
 * unauthenticated download, id tampering / path traversal, header injection
 * through user text, unsafe response headers and internal data inside the file.
 */
describe('RF-21 Security - Download the movement voucher as PDF', () => {
  let ctx: SecurityTestApp;
  let client: HttpClient;
  let manager: string;
  let movement: { id: string; code: string };

  beforeAll(async () => {
    ctx = await startSecurityTestApp();
    client = httpClient(ctx.baseUrl);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    ctx.prisma.reset();
    manager = tokenFor(USERS.MANAGER);
    movement = await createConfirmed(client, manager, {
      type: MovementType.OUTBOUND,
      // User-controlled text that tries to break out of Content-Disposition.
      note: '"; filename="../../evil.exe"\r\nX-Injected: 1',
      items: [{ productId: PRODUCTS.A_RUM, quantity: 6, unit: MovementUnit.BOTTLE }],
    });
  });

  it("cannot download another organization's voucher: 404 and no PDF bytes", async () => {
    const response = await client.get(`/movements/${B_MOVEMENT.id}/pdf`, { token: manager });

    expectErrorShape(response, 404);
    expect(isPdf(response.raw)).toBe(false);
    expect(response.headers.get('content-disposition')).toBeNull();
    expect(response.text).not.toContain(B_MOVEMENT.code);
  });

  it.each([
    ['no credentials', () => undefined],
    ['an expired token', () => expiredTokenFor(USERS.MANAGER)],
    ['a token signed with another secret', () => tokenSignedWithWrongSecret(USERS.MANAGER)],
    ['a suspended user', () => tokenFor(USERS.SUSPENDED_MANAGER)],
  ])('refuses %s with 401 and serves no document', async (_label, token) => {
    const response = await client.get(`/movements/${movement.id}/pdf`, { token: token() });

    expectErrorShape(response, 401);
    expect(isPdf(response.raw)).toBe(false);
  });

  it('does not accept the token as a query parameter (would leak into logs and Referer)', async () => {
    const response = await client.get(`/movements/${movement.id}/pdf?access_token=${manager}`);

    expectErrorShape(response, 401);
    expect(isPdf(response.raw)).toBe(false);
  });

  it.each([
    ['an encoded path traversal', encodeURIComponent('../../../../etc/passwd')],
    ['an encoded Windows traversal', encodeURIComponent('..\\..\\windows\\win.ini')],
    ['an SQL-injection string', encodeURIComponent("' OR '1'='1")],
    ['a null byte', `${movement?.id ?? 'x'}%00.pdf`],
    ['a script tag', encodeURIComponent('<script>alert(1)</script>')],
  ])('rejects %s as the id with 400 and never returns a PDF', async (_label, id) => {
    const response = await client.get(`/movements/${id}/pdf`, { token: manager });

    expectErrorShape(response, 400);
    expect(isPdf(response.raw)).toBe(false);
  });

  it('an unencoded traversal path does not resolve to a file either', async () => {
    const response = await client.get('/movements/../../../../etc/passwd/pdf', { token: manager });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(isPdf(response.raw)).toBe(false);
    expect(response.text).not.toMatch(/root:.*:0:0:/);
  });

  it('serves the voucher with safe headers and a server-derived filename', async () => {
    const response = await client.get(`/movements/${movement.id}/pdf`, { token: manager });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^application\/pdf/);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-powered-by')).toBeNull();
    // The note's injection attempt never reaches the header.
    expect(response.headers.get('content-disposition')).toBe(`attachment; filename="${movement.code}.pdf"`);
    expect(response.headers.get('x-injected')).toBeNull();
    expect(isPdf(response.raw)).toBe(true);
  });

  it('the PDF metadata exposes no user email, internal ids, credential hash or secret', async () => {
    const response = await client.get(`/movements/${movement.id}/pdf`, { token: manager });
    const document = await PDFDocument.load(response.raw);

    const metadata = [
      document.getTitle(),
      document.getAuthor(),
      document.getSubject(),
      document.getKeywords(),
      document.getCreator(),
      document.getProducer(),
    ].join(' | ');

    for (const secret of [
      USERS.MANAGER.email,
      USERS.MANAGER.id,
      ORG_A,
      movement.id,
      FAKE_PASSWORD_HASH,
      TEST_JWT_SECRET,
    ]) {
      expect(metadata).not.toContain(secret);
      expect(response.raw.includes(secret)).toBe(false);
    }
  });

  it('error responses on this route cannot be rendered as active content', async () => {
    // The route's @Header('Content-Type', 'application/pdf') also labels its
    // JSON errors; see README. What matters for safety is that they are never
    // HTML, the browser is told not to sniff, and they carry no internals.
    const response = await client.get(`/movements/${encodeURIComponent('<img src=x onerror=alert(1)>')}/pdf`, {
      token: manager,
    });

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).not.toMatch(/text\/html/);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expectNoSensitiveData(response);
  });

  it('a failure while building the voucher answers a generic 500 with no internals', async () => {
    ctx.prisma.failNext(
      'organization.findUnique',
      new Error(`relation "organizations" unreachable at ${FAKE_DATABASE_URL}`),
    );

    const response = await client.get(`/movements/${movement.id}/pdf`, { token: manager });

    expectErrorShape(response, 500);
    expect(response.json.message).toBe('Internal server error');
    expect(isPdf(response.raw)).toBe(false);
    expect(response.text).not.toContain('organizations');
  });
});
