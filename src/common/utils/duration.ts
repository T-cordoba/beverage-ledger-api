const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
};

/**
 * Converts `15m`, `30d`… to seconds. The environment is validated against the
 * same shape, so a bad value fails at startup rather than here.
 *
 * @throws {Error} when the format does not match.
 */
export function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);

  if (!match) {
    throw new Error(`Unsupported duration: ${value}`);
  }

  return Number(match[1]) * (UNIT_SECONDS[match[2] as string] as number);
}
