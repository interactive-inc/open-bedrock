import { Glob } from "bun"
import { existsSync, readFileSync } from "node:fs"
import { relative, resolve } from "node:path"
import process from "node:process"
import ts from "typescript"

const PROJECT_ROOT = resolve(import.meta.dir, "..")
const SOURCE_ROOT = resolve(PROJECT_ROOT, "src")
const CONTEXTS_ROOT = resolve(SOURCE_ROOT, "contexts")

const CONTEXT_LAYERS = ["domain", "application", "infrastructure", "interface"] as const
const LAYER_FIRST_PLATFORM_DIRECTORIES = new Set([
  "lib",
  "middlewares",
  "routes",
  "shared",
  "test-helpers",
  "utils",
])

export type ContextLayer = (typeof CONTEXT_LAYERS)[number]

export type ContextSource = Readonly<{
  context: string
  layer: ContextLayer
}>

export type ContextBoundaryViolation = Readonly<{
  file: string
  reason: string
}>

function isContextLayer(value: string): value is ContextLayer {
  return CONTEXT_LAYERS.some((layer) => layer === value)
}

/** context-first と移行前の layer-first path を同じ所有情報へ正規化する。 */
export function classifyContextSource(file: string): ContextSource | null {
  const normalized = file.replaceAll("\\", "/")
  const contextFirst = normalized.match(
    /(?:^|\/)src\/contexts\/([^/]+)\/(domain|application|infrastructure|interface)(?:\/|$)/,
  )

  if (contextFirst !== null) {
    const context = contextFirst[1]
    const layer = contextFirst[2]

    return context !== undefined && layer !== undefined && isContextLayer(layer)
      ? { context, layer }
      : null
  }

  const layerFirst = normalized.match(
    /(?:^|\/)src\/(?:api\/)?(domain|application|infrastructure|interface)\/([^/]+)(?:\/|$)/,
  )

  if (layerFirst === null) return null

  const layer = layerFirst[1]
  const context = layerFirst[2]

  return context !== undefined &&
    layer !== undefined &&
    isContextLayer(layer) &&
    !LAYER_FIRST_PLATFORM_DIRECTORIES.has(context)
    ? { context, layer }
    : null
}

/** module aliasを、参照先contextとlayerへ正規化する。 */
export function classifyContextModule(moduleSpecifier: string): ContextSource | null {
  const systemReference = moduleSpecifier.match(
    /^@system\/(domain|application|infrastructure|interface)\//,
  )

  if (systemReference !== null) {
    const layer = systemReference[1]

    return layer !== undefined && isContextLayer(layer) ? { context: "system", layer } : null
  }

  const contextFirst = moduleSpecifier.match(
    /^@\/contexts\/([^/]+)\/(domain|application|infrastructure|interface)(?:\/|$)/,
  )

  if (contextFirst !== null) {
    const context = contextFirst[1]
    const layer = contextFirst[2]

    return context !== undefined && layer !== undefined && isContextLayer(layer)
      ? { context, layer }
      : null
  }

  const layerFirst = moduleSpecifier.match(
    /^@\/(?:api\/)?(domain|application|infrastructure|interface)\/([^/]+)(?:\/|$)/,
  )

  if (layerFirst === null) return null

  const layer = layerFirst[1]
  const context = layerFirst[2]

  return context !== undefined &&
    layer !== undefined &&
    isContextLayer(layer) &&
    !LAYER_FIRST_PLATFORM_DIRECTORIES.has(context)
    ? { context, layer }
    : null
}

/** System > Company > 業務の一方向依存だけを許可する。 */
export function canContextDependOn(sourceContext: string, targetContext: string): boolean {
  if (sourceContext === targetContext) return true
  if (sourceContext === "system") return false
  if (sourceContext === "company") return targetContext === "system"

  return targetContext === "system" || targetContext === "company"
}

function getModuleSpecifier(node: ts.Node): string | null | Error {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    const moduleSpecifier = node.moduleSpecifier

    return moduleSpecifier !== undefined && ts.isStringLiteralLike(moduleSpecifier)
      ? moduleSpecifier.text
      : null
  }

  if (ts.isImportEqualsDeclaration(node)) {
    const reference = node.moduleReference

    return ts.isExternalModuleReference(reference) &&
      reference.expression !== undefined &&
      ts.isStringLiteralLike(reference.expression)
      ? reference.expression.text
      : null
  }

  if (ts.isImportTypeNode(node)) {
    return ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)
      ? node.argument.literal.text
      : new Error("型 import 先を静的に確認できません")
  }

  if (!ts.isCallExpression(node)) return null

  const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
  const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require"

  if (!isDynamicImport && !isRequire) return null

  const argument = node.arguments[0]

  return argument !== undefined && ts.isStringLiteralLike(argument)
    ? argument.text
    : new Error("動的依存先を静的に確認できません")
}

function inspectModuleDependency(
  file: string,
  source: ContextSource,
  moduleSpecifier: string,
): ContextBoundaryViolation[] {
  if (moduleSpecifier.startsWith("./") || moduleSpecifier.startsWith("../")) {
    return [{ file, reason: "context境界を迂回する相対 import があります" }]
  }

  const target = classifyContextModule(moduleSpecifier)

  if (target !== null) {
    return canContextDependOn(source.context, target.context)
      ? []
      : [
          {
            file,
            reason: `${source.context} から ${target.context} context へ依存しています: ${moduleSpecifier}`,
          },
        ]
  }

  if (moduleSpecifier === "@/schema" || moduleSpecifier.startsWith("@/schema/")) {
    return [{ file, reason: `context外の schema へ依存しています: ${moduleSpecifier}` }]
  }

  if (
    moduleSpecifier === "@/api" ||
    (moduleSpecifier.startsWith("@/api/") &&
      !/^@\/api\/(?:domain|application|infrastructure|interface)\//.test(moduleSpecifier))
  ) {
    return [{ file, reason: `contextから API root へ依存しています: ${moduleSpecifier}` }]
  }

  if (
    moduleSpecifier === "@/interface/routes" ||
    moduleSpecifier.startsWith("@/interface/routes/")
  ) {
    return [{ file, reason: `context外の route composition へ依存しています: ${moduleSpecifier}` }]
  }

  return []
}

/** context sourceのimport/export/type import/動的依存を同じ規則で検査する。 */
export function inspectContextSource(file: string, sourceText: string): ContextBoundaryViolation[] {
  const contextSource = classifyContextSource(file)
  if (contextSource === null) return []
  const ownedSource: ContextSource = contextSource

  const violations: ContextBoundaryViolation[] = []
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  function visit(node: ts.Node): void {
    const moduleSpecifier = getModuleSpecifier(node)

    if (moduleSpecifier instanceof Error) {
      violations.push({ file, reason: moduleSpecifier.message })
    } else if (moduleSpecifier !== null) {
      violations.push(...inspectModuleDependency(file, ownedSource, moduleSpecifier))
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return violations
}

/** src/libにcontext・API・DBの所有責務が流入していないか検査する。 */
export function inspectLibSource(file: string, sourceText: string): ContextBoundaryViolation[] {
  const violations: ContextBoundaryViolation[] = []
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  function visit(node: ts.Node): void {
    const moduleSpecifier = getModuleSpecifier(node)

    if (moduleSpecifier instanceof Error) {
      violations.push({ file, reason: moduleSpecifier.message })
    } else if (
      moduleSpecifier !== null &&
      (classifyContextModule(moduleSpecifier) !== null ||
        moduleSpecifier === "@/schema" ||
        moduleSpecifier.startsWith("@/schema/") ||
        moduleSpecifier === "@/api" ||
        moduleSpecifier.startsWith("@/api/"))
    ) {
      violations.push({
        file,
        reason: `lib から所有者のある実装へ依存しています: ${moduleSpecifier}`,
      })
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return violations
}

/** 移行済みのcontext-first production sourceを自動検査する。 */
export async function checkContextBoundaries(): Promise<ContextBoundaryViolation[]> {
  if (!existsSync(CONTEXTS_ROOT)) return []

  const violations: ContextBoundaryViolation[] = []

  for await (const file of new Glob("**/*.{ts,tsx}").scan(CONTEXTS_ROOT)) {
    if (/\.(?:test|spec)\.tsx?$/.test(file)) continue

    const path = resolve(CONTEXTS_ROOT, file)
    violations.push(
      ...inspectContextSource(relative(PROJECT_ROOT, path), readFileSync(path, "utf8")),
    )
  }

  return violations
}

if (import.meta.main) {
  const violations = await checkContextBoundaries()

  if (violations.length > 0) {
    for (const violation of violations) console.error(`${violation.file}: ${violation.reason}`)
    process.exit(1)
  }

  console.log("context-first の依存境界を確認しました")
}
