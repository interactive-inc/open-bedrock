import { Glob } from "bun"
import { readFileSync } from "node:fs"
import { relative, resolve } from "node:path"
import ts from "typescript"

const API_ROOT = resolve(import.meta.dir, "..")
const SYSTEM_ROOTS = [
  resolve(API_ROOT, "src/domain/system"),
  resolve(API_ROOT, "src/application/system"),
  resolve(API_ROOT, "src/infrastructure/system"),
  resolve(API_ROOT, "src/schema"),
] as const

const FORBIDDEN_VOCABULARY =
  /employee|employment|organization|department|company|facility|personnel|workforce|humanresource|thanks|shift|expense|leave|ringi|announcement|twit|chat|care/i
const CONTEXT_MODULE = /^@\/(domain|application|infrastructure|schema)(?:\/(.*))?$/

export type SystemBoundaryViolation = Readonly<{
  file: string
  reason: string
}>

function getModuleSpecifier(node: ts.Node): string | null | Error {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    const moduleSpecifier = node.moduleSpecifier

    return moduleSpecifier !== undefined && ts.isStringLiteralLike(moduleSpecifier)
      ? moduleSpecifier.text
      : null
  }

  if (ts.isImportEqualsDeclaration(node)) {
    const moduleReference = node.moduleReference

    return ts.isExternalModuleReference(moduleReference) &&
      moduleReference.expression !== undefined &&
      ts.isStringLiteralLike(moduleReference.expression)
      ? moduleReference.expression.text
      : null
  }

  if (ts.isImportTypeNode(node)) {
    return ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)
      ? node.argument.literal.text
      : new Error("System の型import先を静的に確認できません")
  }

  if (!ts.isCallExpression(node)) {
    return null
  }

  const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
  const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require"

  if (!isDynamicImport && !isRequire) {
    return null
  }

  const moduleSpecifier = node.arguments[0]

  return moduleSpecifier !== undefined && ts.isStringLiteralLike(moduleSpecifier)
    ? moduleSpecifier.text
    : new Error("System の動的依存先を静的に確認できません")
}

function inspectModuleSpecifier(file: string, moduleSpecifier: string): SystemBoundaryViolation[] {
  if (moduleSpecifier.startsWith("./") || moduleSpecifier.startsWith("../")) {
    return [{ file, reason: "System の依存境界を迂回する相対 import があります" }]
  }

  const contextModule = moduleSpecifier.match(CONTEXT_MODULE)

  if (contextModule === null) {
    return []
  }

  const importedPath = contextModule[2] ?? ""
  const isAllowed =
    importedPath === "system" ||
    importedPath.startsWith("system/") ||
    importedPath.startsWith("shared/")

  return isAllowed
    ? []
    : [{ file, reason: `System から上位コンテキストへ依存しています: ${moduleSpecifier}` }]
}

/** System 実装1ファイルに、上位コンテキストの語彙または依存が混入していないか調べる。 */
export function inspectSystemSource(file: string, source: string): SystemBoundaryViolation[] {
  const violations: SystemBoundaryViolation[] = []
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const forbiddenVocabularies: string[] = []

  function visit(node: ts.Node): void {
    const vocabularySource =
      ts.isIdentifier(node) || ts.isPrivateIdentifier(node) || ts.isStringLiteralLike(node)
        ? node.text
        : null
    const matchedVocabulary = vocabularySource?.match(FORBIDDEN_VOCABULARY)?.[0]

    if (forbiddenVocabularies.length === 0 && matchedVocabulary !== undefined) {
      forbiddenVocabularies.push(matchedVocabulary)
    }

    const moduleSpecifier = getModuleSpecifier(node)

    if (moduleSpecifier instanceof Error) {
      violations.push({ file, reason: moduleSpecifier.message })
    } else if (moduleSpecifier !== null) {
      violations.push(...inspectModuleSpecifier(file, moduleSpecifier))
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  const forbiddenVocabulary = forbiddenVocabularies[0]

  if (forbiddenVocabulary !== undefined) {
    violations.unshift({
      file,
      reason: `System に上位コンテキストの語彙 "${forbiddenVocabulary}" があります`,
    })
  }

  return violations
}

export async function checkSystemContextBoundary(): Promise<SystemBoundaryViolation[]> {
  const violations: SystemBoundaryViolation[] = []

  for (const root of SYSTEM_ROOTS) {
    for await (const file of new Glob("**/*.ts").scan(root)) {
      if (file.endsWith(".test.ts")) {
        continue
      }

      const absoluteFile = resolve(root, file)
      violations.push(
        ...inspectSystemSource(
          relative(API_ROOT, absoluteFile),
          readFileSync(absoluteFile, "utf8"),
        ),
      )
    }
  }

  return violations
}

if (import.meta.main) {
  const violations = await checkSystemContextBoundary()

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(`${violation.file}: ${violation.reason}`)
    }
    process.exit(1)
  }

  console.log("System context の依存境界を確認しました")
}
