import { BadRequestException } from '@nestjs/common';
import { expect } from 'chai';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { resolveRange } from '../src/modules/reports/report-range';

const now = new Date('2026-09-01T12:00:00.000Z');
const day = 24 * 60 * 60 * 1000;

describe('RF-28 regression - consumption report range', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a range that starts and ends at the same instant is valid', () => {
    const instant = new Date('2026-08-15T00:00:00.000Z');

    const resolve = () => resolveRange({ from: instant, to: instant });

    expect(resolve, 'single-instant range').to.not.throw();
  });

  it('with no dates the report covers exactly the last thirty days', () => {
    const query = {};

    const range = resolveRange(query);

    expect(range.to.getTime() - range.from.getTime(), 'span').to.equal(30 * day);
    expect(range.to, 'end').to.deep.equal(now);
  });

  it('a backwards range is refused with a message the user can read', () => {
    const from = new Date('2026-08-24T00:00:00.000Z');
    const to = new Date('2026-08-01T00:00:00.000Z');

    const resolve = () => resolveRange({ from, to });

    expect(resolve, 'backwards range')
      .to.throw(BadRequestException, 'The range starts after it ends')
      .with.nested.property('response.statusCode', 400);
  });

  it('echoes back the very dates it was given, with no extra fields', () => {
    const from = new Date('2026-08-01T00:00:00.000Z');
    const to = new Date('2026-08-24T00:00:00.000Z');

    const range = resolveRange({ from, to });

    expect(range, 'range').to.have.all.keys('from', 'to');
    expect(range.from, 'start').to.equal(from);
    expect(range.to, 'end').to.equal(to);
  });
});
