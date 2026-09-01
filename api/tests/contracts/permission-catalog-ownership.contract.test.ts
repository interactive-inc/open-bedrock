import { Glob } from "bun"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import ts from "typescript"

const repositoryRoot = resolve(import.meta.dir, "../../..")

/**
 * 権限語彙の合成層。App contextがここへ依存すると、Appを消しても
 * 語彙が composition 側に残り、所有関係が逆流する。
 * factory や verify-bearer のようなHTTP配管は各routeが使うため対象にしない。
 */
const compositionModulePrefix = "@/api/http/permissions/"

function toImportedModules(sourceFile: ts.SourceFile): ReadonlyArray<string> {
  const modules: Array<string> = []

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue

    modules.push(statement.moduleSpecifier.text)
  }

  return modules
}

describe("permission catalog ownership", () => {
  test("App contextは権限の合成層をimportしない", () => {
    const files = Array.from(
      new Glob("api/src/contexts/**/*.ts").scanSync({ cwd: repositoryRoot, onlyFiles: true }),
    ).sort()

    const violations = files.filter((file) => {
      const source = readFileSync(resolve(repositoryRoot, file), "utf8")
      const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)

      return toImportedModules(sourceFile).some((module) =>
        module.startsWith(compositionModulePrefix),
      )
    })

    expect(violations).toEqual([])
  })
})
