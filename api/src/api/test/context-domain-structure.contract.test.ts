import { Glob } from "bun"
import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { basename, resolve } from "node:path"

const contextsRoot = resolve(import.meta.dir, "../../contexts")
const allowedRootEntries = new Set([
  "entities",
  "values",
  "schemas",
  "catalogs",
  "definitions",
  "policies",
  "errors.ts",
])

describe("bounded context domain structure", () => {
  test("Domain直下をEntity・Value・Policy・集約Errorだけに限定する", () => {
    const violations: string[] = []

    for (const context of readdirSync(contextsRoot, { withFileTypes: true })) {
      if (!context.isDirectory()) continue
      const domainRoot = resolve(contextsRoot, context.name, "domain")

      try {
        for (const entry of readdirSync(domainRoot, { withFileTypes: true })) {
          if (!allowedRootEntries.has(entry.name)) {
            violations.push(`${context.name}/${entry.name}: Domain直下の責務外`)
          }
        }
      } catch {
        continue
      }
    }

    expect(violations).toEqual([])
  })

  test("Domain file名を配置責務と一致させる", () => {
    const violations: string[] = []

    for (const path of new Glob(
      "*/domain/{entities,values,schemas,catalogs,definitions,policies}/**/*.ts",
    ).scanSync({
      cwd: contextsRoot,
      onlyFiles: true,
    })) {
      const filename = basename(path)
      const source = readFileSync(resolve(contextsRoot, path), "utf8")

      if (path.includes("/entities/") && !/\.entity(?:\.test)?\.ts$/u.test(filename)) {
        violations.push(`${path}: Entity suffix`)
      }
      if (path.includes("/policies/") && !/\.policy(?:\.test)?\.ts$/u.test(filename)) {
        violations.push(`${path}: Policy suffix`)
      }
      if (path.includes("/values/") && !/\.value(?:\.test)?\.ts$/u.test(filename)) {
        violations.push(`${path}: Value suffix`)
      }
      if (path.includes("/schemas/") && !/\.schema(?:\.test)?\.ts$/u.test(filename)) {
        violations.push(`${path}: Schema suffix`)
      }
      if (path.includes("/catalogs/") && !/\.catalog(?:\.test)?\.ts$/u.test(filename)) {
        violations.push(`${path}: Catalog suffix`)
      }
      if (path.includes("/definitions/") && !/\.definition(?:\.test)?\.ts$/u.test(filename)) {
        violations.push(`${path}: Definition suffix`)
      }
      if (/export class \w*Error extends Error/u.test(source)) {
        violations.push(`${path}: Domain Errorはdomain/errors.tsへ集約する`)
      }
    }

    expect(violations).toEqual([])
  })
})
