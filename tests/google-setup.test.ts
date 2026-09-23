import { describe, expect, it } from "vitest";
import { googleSetupStatus } from "@/lib/google-setup";

describe("google setup status", () => {
  it("builds redirect URIs from APP_URL", () => {
    const s = googleSetupStatus({ APP_URL: "https://app.example.com/", GOOGLE_CLIENT_ID: "1-a.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "GOCSPX-x" });
    expect(s.configured).toBe(true);
    expect(s.redirectUris).toEqual({
      login: "https://app.example.com/api/auth/google/callback",
      connect: "https://app.example.com/api/connections/google/callback",
    });
    expect(s.javascriptOrigin).toBe("https://app.example.com");
  });
  it("reports missing or malformed values", () => {
    expect(googleSetupStatus({}).configured).toBe(false);
    expect(googleSetupStatus({ GOOGLE_CLIENT_ID: "abc", GOOGLE_CLIENT_SECRET: "GOCSPX-x" }).issues.join()).toContain("形式");
  });
  it("rejects plain http outside localhost", () => {
    const s = googleSetupStatus({ APP_URL: "http://app.example.com", GOOGLE_CLIENT_ID: "1-a.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "GOCSPX-x" });
    expect(s.configured).toBe(false);
  });
});
