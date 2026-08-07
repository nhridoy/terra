import { describe, expect, it } from "vitest";
import { shouldEvict } from "./keychain";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

describe("shouldEvict", () => {
  it("evicts when metadata is missing", () => {
    expect(shouldEvict(null, null, NOW)).toBe(true);
    expect(shouldEvict(NOW, null, NOW)).toBe(true);
    expect(shouldEvict(null, NOW, NOW)).toBe(true);
  });

  it("keeps a fresh entry", () => {
    expect(shouldEvict(NOW, NOW, NOW)).toBe(false);
  });

  it("keeps an entry within the inactivity window", () => {
    expect(shouldEvict(NOW, NOW - 13 * DAY, NOW)).toBe(false);
  });

  it("evicts an entry past the inactivity window", () => {
    expect(shouldEvict(NOW, NOW - 15 * DAY, NOW)).toBe(true);
  });

  it("evicts an entry past the absolute age cap", () => {
    expect(shouldEvict(NOW - 91 * DAY, NOW - 1 * DAY, NOW)).toBe(true);
  });

  it("keeps an entry within the absolute age cap", () => {
    expect(shouldEvict(NOW - 89 * DAY, NOW - 1 * DAY, NOW)).toBe(false);
  });

  it("honors custom thresholds", () => {
    expect(shouldEvict(NOW, NOW - 8 * DAY, NOW, 7, 90)).toBe(true);
    expect(shouldEvict(NOW, NOW - 6 * DAY, NOW, 7, 90)).toBe(false);
  });

  it("evicts immediately with a zero inactivity threshold", () => {
    expect(shouldEvict(NOW, NOW - 1000, NOW, 0, 90)).toBe(true);
  });
});
