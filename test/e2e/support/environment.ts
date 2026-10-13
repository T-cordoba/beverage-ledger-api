/**
 * The E2E suite talks to a running API with a real database, so it only runs
 * when told where that API is. Unset, every file is skipped: `pnpm test` and
 * the Jenkins coverage stage keep working with no server and no network.
 */
const apiUrl = process.env.E2E_API_URL ?? '';

const isLocal = (url: string) => {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
};

/**
 * Every scenario writes movements to the ledger. They are voided as the last
 * step, but a voided movement stays in the history for good, so a shared
 * database (Render, Supabase) is refused unless someone opts in on purpose.
 */
const writesAllowed = isLocal(apiUrl) || process.env.E2E_ALLOW_REMOTE_WRITES === 'true';

export const environment = {
  apiUrl,
  shouldRun: apiUrl !== '' && writesAllowed,
  credentials: () => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password) {
      throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD are required with E2E_API_URL');
    }
    return { email, password };
  },
};

/** Marks every voided-on-purpose movement, so a leftover is easy to tell apart. */
export const E2E_NOTE = 'E2E backend test';

/**
 * Enough for a step that waits out the API throttle (see CallAnApi). Vitest
 * applies a describe's timeout to its tests only, so hooks take it explicitly:
 * the sign-in, and the cleanup that may have to wait as well.
 */
export const SCENARIO_TIMEOUT_MS = 180_000;
export const HOOK_TIMEOUT_MS = 180_000;
