/**
 * Returns random integer between 0 and 4294967295.
 *
 * @returns random integer between 0 and 4294967295
 */
export function randomInt(): number {
    return Math.floor(Math.random() * 0xffffffff);
}

/**
 * Returns random string of given length.
 *
 * @param n - length of string
 * @returns random string of length `n`
 */
export function randomString(n = 8): string {
    return [...Array(n)].map(() => Math.random().toString(36)[2]).join('');
}

/**
 * Sleeps for specified time.
 *
 * @param ms - duration in milliseconds
 * @returns `Promise` which will be resolved after `ms` milliseconds
 */
export async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries the specified asynchronous function the given amount of times in case of fail.
 *
 * @param attemptFunc - asynchronous function which will be retried
 * @param attempts - retries count
 * @param delay - delay in milliseconds between retries
 * @returns result of `attemptFunc` in case of success and
 *    throws error if `attemptFunc` fails `attempts` times
 */
export async function retry<T>(
    attemptFunc: () => Promise<T>,
    attempts = 3,
    delay = 1000
): Promise<T> {
    let remaining = attempts;

    async function makeAttempt(): Promise<T> {
        const onError = async (err: Error): Promise<T> => {
            if (remaining === 0) {
                throw err;
            }

            if (delay) {
                await sleep(delay);
            }

            return makeAttempt();
        };

        if (remaining > 0) {
            remaining--;
        }

        return attemptFunc().catch(onError);
    }

    return makeAttempt();
}
