import { describe, expect, it } from "vitest";
import { hedged } from "../lib/hedged";

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    });
  });

describe("hedged", () => {
  it("uses only one attempt when the first answers quickly", async () => {
    const started: number[] = [];
    const result = await hedged(async (n) => {
      started.push(n);
      return "fast";
    }, 50);
    await wait(80);
    expect(result).toBe("fast");
    expect(started).toEqual([1]);
  });

  it("starts a backup when the first is slow, and cancels the slow one", async () => {
    const aborted: number[] = [];
    const result = await hedged(async (n, signal) => {
      signal.addEventListener("abort", () => aborted.push(n));
      await wait(n === 1 ? 500 : 10, signal);
      return `attempt ${n}`;
    }, 30);
    expect(result).toBe("attempt 2");
    expect(aborted).toContain(1);
  });

  it("retries straight away when the first attempt fails", async () => {
    const t0 = Date.now();
    const result = await hedged(async (n) => {
      if (n === 1) throw new Error("server error");
      return "second";
    }, 5_000);
    expect(result).toBe("second");
    expect(Date.now() - t0).toBeLessThan(1_000);
  });

  it("does not retry a final error, such as a rejected image", async () => {
    let attempts = 0;
    const rejected = new Error("rejected");
    await expect(
      hedged(async () => {
        attempts++;
        throw rejected;
      }, 5_000, (e) => e === rejected),
    ).rejects.toBe(rejected);
    expect(attempts).toBe(1);
  });

  it("fails only after both attempts fail", async () => {
    await expect(
      hedged(async (n) => {
        throw new Error(`fail ${n}`);
      }, 5_000),
    ).rejects.toThrow("fail 2");
  });
});
