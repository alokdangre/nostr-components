import { describe, expect, it } from "vitest";
import { directoryProfiles } from "./data";
import {
  formatFollowers,
  getVisibleProfiles,
  normalizeSearch,
  truncateNpub,
} from "./directory";

const baseFilters = {
  category: "Popular on X.com" as const,
  query: "",
};

describe("directory filtering", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizeSearch("  NIP-05  ")).toBe("nip-05");
  });

  it("finds profiles across handles, NIP-05 and categories", () => {
    expect(
      getVisibleProfiles(directoryProfiles, {
        ...baseFilters,
        query: "@GUYSWANN",
      }).map((profile) => profile.id),
    ).toEqual(["guy-swann"]);

    expect(
      getVisibleProfiles(directoryProfiles, {
        ...baseFilters,
        query: "x.com",
      }).map((profile) => profile.id),
    ).toEqual(["jack", "tbot", "guy-swann"]);
  });

  it("keeps each tab limited to its platform", () => {
    expect(
      getVisibleProfiles(directoryProfiles, {
        ...baseFilters,
        category: "Popular on Nostr",
      }).map((profile) => profile.id),
    ).toEqual(["damus", "nostr", "snort"]);
  });
});

describe("directory formatting", () => {
  it("formats follower counts for compact display", () => {
    expect(formatFollowers(311_200)).toBe("311.2K");
    expect(formatFollowers(1_000_000)).toBe("1M");
    expect(formatFollowers(820)).toBe("820");
  });

  it("truncates long public keys without hiding their ends", () => {
    expect(truncateNpub("npub1234567890abcdefghijklmnopqrstuvwxyz")).toBe(
      "npub12345678…tuvwxyz",
    );
  });
});
