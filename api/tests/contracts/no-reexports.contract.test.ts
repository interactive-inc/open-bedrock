import { Glob } from "bun"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import ts from "typescript"

const repositoryRoot = resolve(import.meta.dir, "../../..")
const sourceGlobs = [
  "api/src/**/*.ts",
  "api/src/**/*.tsx",
  "cli/*.ts",
  "cli/app/**/*.ts",
  "cli/lib/**/*.ts",
  "mcp/*.ts",
  "mcp/lib/**/*.ts",
  "web/*.ts",
  "web/app/**/*.ts",
  "web/app/**/*.tsx",
  "web/components/**/*.ts",
  "web/components/**/*.tsx",
  "web/hooks/**/*.ts",
  "web/hooks/**/*.tsx",
  "web/lib/**/*.ts",
  "web/lib/**/*.tsx",
]

function hasReExport(sourceFile: ts.SourceFile): boolean {
  const importedNames = new Set<string>()
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const clause = statement.importClause
    if (clause?.name !== undefined) importedNames.add(clause.name.text)
    const bindings = clause?.namedBindings
    if (bindings === undefined) continue
    if (ts.isNamespaceImport(bindings)) importedNames.add(bindings.name.text)
    else for (const element of bindings.elements) importedNames.add(element.name.text)
  }

  return sourceFile.statements.filter(ts.isExportDeclaration).some((declaration) => {
    if (declaration.moduleSpecifier !== undefined) return true
    if (declaration.exportClause === undefined || !ts.isNamedExports(declaration.exportClause)) {
      return false
    }
    return declaration.exportClause.elements.some((element) =>
      importedNames.has(element.propertyName?.text ?? element.name.text),
    )
  })
}

describe("source module ownership", () => {
  test("全workspaceのproduction sourceにre-exportを置かない", () => {
    const files = [
      ...new Set(
        sourceGlobs.flatMap((pattern) =>
          Array.from(new Glob(pattern).scanSync({ cwd: repositoryRoot, onlyFiles: true })),
        ),
      ),
    ].sort()
    const violations = files.filter((file) => {
      const source = readFileSync(resolve(repositoryRoot, file), "utf8")
      const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
      return hasReExport(sourceFile)
    })

    expect(violations).toEqual([])
  })
})
