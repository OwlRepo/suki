import { describe, expect, it } from "vitest";
import { SHARE_SLOTS_PAGE_COPY } from "./share-slots-copy";

describe("share slots page copy", () => {
  it("keeps copy platform-neutral", () => {
    expect(SHARE_SLOTS_PAGE_COPY.title.toLowerCase()).not.toContain("facebook");
    expect(SHARE_SLOTS_PAGE_COPY.description.toLowerCase()).not.toContain("facebook");
  });
});
