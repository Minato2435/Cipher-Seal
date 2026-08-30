import { describe, expect, it } from "vitest";
import { bandColor, groupHex, middleTruncate } from "./format";

describe("format", () => {
  it("groups hex by byte", () => {
    // base64 of [0xde, 0xad, 0xbe, 0xef]
    expect(groupHex("3q2+7w==")).toBe("de ad be ef");
  });

  it("middle-truncates long strings and leaves short ones alone", () => {
    expect(middleTruncate("abcdefghijklmnopqrstuvwxyz", 12)).toBe("abcde…vwxyz");
    expect(middleTruncate("short", 12)).toBe("short");
  });

  it("maps risk bands to the ramp", () => {
    expect(bandColor("NORMAL")).toBe("#3A4453");
    expect(bandColor("ELEVATED")).toBe("#C98A2B");
    expect(bandColor("HIGH")).toBe("#C1541F");
    expect(bandColor("CRITICAL")).toBe("#A01E22");
    expect(bandColor("???")).toBe("#3A4453");
  });
});
