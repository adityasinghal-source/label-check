// Runs `attempt`, adding one backup attempt if the first hasn't succeeded after `hedgeAfterMs`
// or fails with a retryable error. The first success wins and the other attempt is cancelled.
// Errors for which `isFinal` returns true (e.g. a rejected image) are not retried.
export function hedged<T>(
  attempt: (n: number, signal: AbortSignal) => Promise<T>,
  hedgeAfterMs: number,
  isFinal: (error: unknown) => boolean = () => false,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const controllers: AbortController[] = [];
    let settled = false;
    let failed = 0;
    const finish = (done: () => void) => {
      settled = true;
      clearTimeout(timer);
      controllers.forEach((c) => c.abort());
      done();
    };
    const launch = () => {
      const controller = new AbortController();
      controllers.push(controller);
      attempt(controllers.length, controller.signal).then(
        (value) => !settled && finish(() => resolve(value)),
        (error) => {
          if (settled) return;
          failed++;
          if (isFinal(error)) finish(() => reject(error));
          else if (controllers.length < 2) launch();
          else if (failed === controllers.length) finish(() => reject(error));
        },
      );
    };
    const timer = setTimeout(() => !settled && controllers.length < 2 && launch(), hedgeAfterMs);
    launch();
  });
}
