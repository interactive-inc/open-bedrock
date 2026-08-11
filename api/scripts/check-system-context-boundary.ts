import { Glob } from "bun"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { relative, resolve } from "node:path"
import process from "node:process"
import ts from "typescript"

const PROJECT_ROOT = resolve(import.meta.dir, "..")
const SOURCE_ROOT = resolve(PROJECT_ROOT, "src")
const API_SOURCE_ROOT = existsSync(resolve(SOURCE_ROOT, "api"))
  ? resolve(SOURCE_ROOT, "api")
  : SOURCE_ROOT
const CONTEXT_LAYERS = ["domain", "application", "infrastructure", "interface/converters"] as const
const SYSTEM_SOURCE_PATHS = [
  ...CONTEXT_LAYERS.map((layer) => resolve(API_SOURCE_ROOT, layer, "system")),
  resolve(SOURCE_ROOT, "schema/system.ts"),
] as const
const NON_CONTEXT_DIRECTORIES = new Set([
  "core",
  "database",
  "seed",
  "shared",
  "system",
  "test",
  "test-helpers",
])
const FORBIDDEN_VOCABULARY =
  /\b(announcements?|billing|care|chats?|company|companies|departments?|employees?|employments?|expenses?|facilities|facility|human\s+resources?|leaves?|org|organizations?|personnel|residents?|ringi|shifts?|staff|thanks|tweets?|twit|workforces?)\b/i
const LAYER_MODULE =
  /^@\/(?:api\/)?(domain|application|infrastructure|interface\/converters)(?:\/(.*))?$/
const SCHEMA_MODULE = /^@\/schema(?:\/(.*))?$/
const COMPOSITION_MODULE = /^@\/(?:api\/)?composition(?:\/|$)/

export type SystemBoundaryViolation = Readonly<{
  file: string
  reason: string
}>

function normalizeVocabularyBoundaries(value: string): string {
  return value.replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll(/[_./:-]+/g, " ")
}

export function selectDownstreamContextNames(
  directoryNames: Iterable<string>,
): ReadonlySet<string> {
  return new Set(
    [...directoryNames].filter(
      (directoryName) => directoryName.length > 0 && !NON_CONTEXT_DIRECTORIES.has(directoryName),
    ),
  )
}

export function discoverDownstreamContexts(apiSourceRoot = API_SOURCE_ROOT): ReadonlySet<string> {
  const directoryNames: string[] = []

  for (const layer of CONTEXT_LAYERS) {
    const layerRoot = resolve(apiSourceRoot, layer)

    if (!existsSync(layerRoot)) {
      continue
    }

    for (const entry of readdirSync(layerRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        directoryNames.push(entry.name)
      }
    }
  }

  return selectDownstreamContextNames(directoryNames)
}

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
      : new Error("System の型 import 先を静的に確認できません")
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

function inspectModuleSpecifier(
  file: string,
  moduleSpecifier: string,
  downstreamContexts: ReadonlySet<string>,
): SystemBoundaryViolation[] {
  if (moduleSpecifier.startsWith("./") || moduleSpecifier.startsWith("../")) {
    return [{ file, reason: "System の依存境界を迂回する相対 import があります" }]
  }

  if (COMPOSITION_MODULE.test(moduleSpecifier)) {
    return [{ file, reason: `System から composition へ依存しています: ${moduleSpecifier}` }]
  }

  const schemaModule = moduleSpecifier.match(SCHEMA_MODULE)

  if (schemaModule !== null) {
    const importedPath = schemaModule[1] ?? ""
    const isSystemSchema = importedPath === "system" || importedPath.startsWith("system/")

    return isSystemSchema
      ? []
      : [{ file, reason: `System から専用 schema 以外へ依存しています: ${moduleSpecifier}` }]
  }

  const layerModule = moduleSpecifier.match(LAYER_MODULE)

  if (layerModule === null) {
    return []
  }

  const importedPath = layerModule[2] ?? ""
  const contextName = importedPath.split("/")[0] ?? ""

  return downstreamContexts.has(contextName)
    ? [{ file, reason: `System から下位コンテキストへ依存しています: ${moduleSpecifier}` }]
    : []
}

/** System 実装1ファイルに、下位コンテキストの語彙または依存が混入していないか調べる。 */
export function inspectSystemSource(
  file: string,
  source: string,
  downstreamContexts: ReadonlySet<string> = discoverDownstreamContexts(),
): SystemBoundaryViolation[] {
  const violations: SystemBoundaryViolation[] = []
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  let forbiddenVocabulary: string | undefined

  function visit(node: ts.Node): void {
    const vocabularySource =
      ts.isIdentifier(node) || ts.isPrivateIdentifier(node) || ts.isStringLiteralLike(node)
        ? node.text
        : null
    const matchedVocabulary =
      vocabularySource === null
        ? undefined
        : normalizeVocabularyBoundaries(vocabularySource).match(FORBIDDEN_VOCABULARY)?.[0]

    if (forbiddenVocabulary === undefined && matchedVocabulary !== undefined) {
      forbiddenVocabulary = matchedVocabulary
    }

    const moduleSpecifier = getModuleSpecifier(node)

    if (moduleSpecifier instanceof Error) {
      violations.push({ file, reason: moduleSpecifier.message })
    } else if (moduleSpecifier !== null) {
      violations.push(...inspectModuleSpecifier(file, moduleSpecifier, downstreamContexts))
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (forbiddenVocabulary !== undefined) {
    violations.unshift({
      file,
      reason: `System に下位コンテキストの語彙 "${forbiddenVocabulary}" があります`,
    })
  }

  return violations
}

async function inspectSystemPath(
  path: string,
  downstreamContexts: ReadonlySet<string>,
): Promise<SystemBoundaryViolation[]> {
  if (!existsSync(path)) {
    return []
  }

  const files: string[] = []

  if (statSync(path).isDirectory()) {
    for await (const file of new Glob("**/*.{ts,tsx}").scan(path)) {
      if (!/\.(?:test|spec)\.tsx?$/.test(file)) {
        files.push(resolve(path, file))
      }
    }
  } else {
    files.push(path)
  }

  return files.flatMap((file) =>
    inspectSystemSource(
      relative(PROJECT_ROOT, file),
      readFileSync(file, "utf8"),
      downstreamContexts,
    ),
  )
}

export async function checkSystemContextBoundary(): Promise<SystemBoundaryViolation[]> {
  const downstreamContexts = discoverDownstreamContexts()
  const violations: SystemBoundaryViolation[] = []

  for (const path of SYSTEM_SOURCE_PATHS) {
    violations.push(...(await inspectSystemPath(path, downstreamContexts)))
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
