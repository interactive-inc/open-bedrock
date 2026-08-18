import { describe, expect, test } from "bun:test"

const sourceRoot = new URL("../../../../", import.meta.url)

describe("canonical Account session issuance boundary", () => {
  test("every production access-token signer revalidates the canonical Account", async () => {
    const signerCallsites: Array<string> = []
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

      if (/\b(?:new\s+JoseTokenSigner\(\)|tokenSigner)\.sign\(/u.test(source)) {
        signerCallsites.push(path)
        expect(
          source.includes("resolveAccountSession") ||
            source.includes("applications.authenticate.execute") ||
            source.includes("applications.issue.execute"),
        ).toBe(true)
        expect(
          source.includes("SystemAccountRepository") ||
            source.includes("createSystemSessionApplications"),
        ).toBe(true)
      }
    }

    expect(signerCallsites.sort()).toEqual([
      "contexts/company-compatibility/application/auth/issue-employee-session.ts",
      "contexts/company-compatibility/application/auth/refresh-access-token.ts",
    ])
  })
})
