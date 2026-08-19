import { describe, expect, test } from "bun:test"

const sourceRoot = new URL("../../../../", import.meta.url)

describe("canonical Account session issuance boundary", () => {
  test("CompanyとAPI compositionがSystem access token実装を所有しない", async () => {
    const violations: Array<string> = []
    const glob = new Bun.Glob("**/*.ts")

    for await (const path of glob.scan({
      cwd: sourceRoot.pathname,
      onlyFiles: true,
    })) {
      if (
        path.endsWith(".test.ts") ||
        path.startsWith("api/test/") ||
        path.includes("/test-helpers/")
      ) {
        continue
      }

      const source = await Bun.file(new URL(path, sourceRoot)).text()
      if (!path.startsWith("contexts/company/") && !path.startsWith("api/")) continue
      if (/\b(?:SignJWT|jwtVerify|AccessTokenService|SystemAccessTokenIssuer)\b/u.test(source)) {
        violations.push(path)
      }
    }

    expect(violations.sort()).toEqual([])
  })
})
