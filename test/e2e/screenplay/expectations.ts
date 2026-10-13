import { expect } from 'chai';

/** Named after their @serenity-js/assertions counterparts, so steps read the same in both repos. */
export const equals = (expected: unknown) => (actual: unknown, label: string) =>
  expect(actual, label).to.deep.equal(expected);

export const doesNotEqual = (unexpected: unknown) => (actual: unknown, label: string) =>
  expect(actual, label).to.not.deep.equal(unexpected);

/** The answer carries at least these properties with these values. */
export const hasProperties = (expected: object) => (actual: unknown, label: string) =>
  expect(actual, label).to.include(expected);

export const startsWith = (prefix: string) => (actual: unknown, label: string) =>
  expect(actual, label)
    .to.be.a('string')
    .and.satisfy((value: string) => value.startsWith(prefix));

export const isTruthy = () => (actual: unknown, label: string) => expect(actual, label).to.be.ok;
