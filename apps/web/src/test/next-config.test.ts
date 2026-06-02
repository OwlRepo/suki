import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("Next production API proxy", () => {
  it("rewrites same-origin /api requests to the API container", async () => {
    const rewritesFn = nextConfig.rewrites;
    expect(typeof rewritesFn).toBe("function");
    if (typeof rewritesFn !== "function") {
      throw new Error("Next rewrites must be configured");
    }

    const rewrites = await rewritesFn();

    expect(rewrites).toEqual(
      expect.arrayContaining([
        {
          source: "/api/:path*",
          destination: "http://api:3001/:path*",
        },
      ]),
    );
  });
});
