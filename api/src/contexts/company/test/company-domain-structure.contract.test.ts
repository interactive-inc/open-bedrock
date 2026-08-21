import { Glob } from "bun"
import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"

const domainRoot = resolve(import.meta.dir, "../domain")

describe("Company domain structure", () => {
  test("domain直下をentities・values・policies・errors.tsだけに限定する", () => {
    expect(
      readdirSync(domainRoot, { withFileTypes: true })
        .map((entry) => `${entry.isDirectory() ? "directory" : "file"}:${entry.name}`)
        .toSorted(),
    ).toEqual(["directory:entities", "directory:policies", "directory:values", "file:errors.ts"])

    const paths = Array.from(new Glob("**/*.ts").scanSync({ cwd: domainRoot, onlyFiles: true }))

    expect(
      paths.filter((path) => {
        if (path === "errors.ts") return false
        const directory = path.split("/")[0]
        return directory !== "entities" && directory !== "values" && directory !== "policies"
      }),
    ).toEqual([])
  })

  test("Domain Errorをerrors.ts以外へ分散させない", () => {
    const violations = Array.from(
      new Glob("{entities,values,policies}/**/*.ts").scanSync({
        cwd: domainRoot,
        onlyFiles: true,
      }),
    ).filter((path) =>
      /export class \w*Error extends Error/.test(readFileSync(resolve(domainRoot, path), "utf8")),
    )

    expect(violations).toEqual([])
  })

  test("Entity・Value・Policyのfile suffixを責務と一致させる", () => {
    const sourceFiles = [
      ...new Glob("{entities,values,policies}/*.ts").scanSync({
        cwd: domainRoot,
      }),
    ].filter((file) => !file.endsWith(".test.ts"))
    const violations = sourceFiles.filter((file) => {
      if (file.startsWith("entities/")) return !file.endsWith(".entity.ts")
      if (file.startsWith("policies/")) return !file.endsWith(".policy.ts")

      return !/\.(?:catalog|definition|schema|value)\.ts$/u.test(file)
    })

    expect(violations).toEqual([])
  })
})
