import { Glob } from "bun"
import { existsSync, readFileSync } from "node:fs"
import { relative, resolve } from "node:path"
import process from "node:process"
import ts from "typescript"
import { z } from "zod"
import { LIB_BOUNDARY_BASELINE } from "./lib-boundary-baseline"

const PROJECT_ROOT = resolve(import.meta.dir, "..")
const SOURCE_ROOT = resolve(PROJECT_ROOT, "src")
const API_ROOT = resolve(SOURCE_ROOT, "api")
const CONTEXTS_ROOT = resolve(SOURCE_ROOT, "contexts")
const LIB_ROOT = resolve(SOURCE_ROOT, "lib")
const OWNERSHIP_MANIFEST_PATH = resolve(PROJECT_ROOT, "context-ownership.json")
const RETIRED_CONTEXT_NAMES = new Set(["request"])

const CONTEXT_LAYERS = ["domain", "application", "infrastructure", "interface"] as const
const API_ROOT_DIRECTORIES = new Set(["routes", "test"])
const API_ROOT_FILES = new Set([
  "api-route-module.ts",
  "app-base.ts",
  "app.ts",
  "database-middleware.ts",
  "read-http-exception-problem.ts",
  "route-module.registry.ts",
  "to-negotiated-http-exception-response.ts",
])
const LAYER_FIRST_PLATFORM_DIRECTORIES = new Set([
  "lib",
  "middlewares",
  "routes",
  "shared",
  "test-helpers",
  "utils",
])
const ownershipManifest = z
  .strictObject({
    companyCoreAreas: z.array(z.string().min(1)),
    companySystemAdapterAreas: z.array(z.string().min(1)),
    companyAreasByLayer: z.strictObject({
      domain: z.array(z.string().min(1)),
      application: z.array(z.string().min(1)),
      infrastructure: z.array(z.string().min(1)),
      interface: z.array(z.string().min(1)),
    }),
    businessAreaOwners: z.record(z.string(), z.string().min(1)),
    routeOwners: z.record(z.string(), z.string().min(1)),
    apiCompositionRoutePrefixes: z.array(z.string().min(1)),
  })
  .parse(JSON.parse(readFileSync(OWNERSHIP_MANIFEST_PATH, "utf8")))

export type ContextLayer = (typeof CONTEXT_LAYERS)[number]

export type ContextSource = Readonly<{
  context: string
  layer: ContextLayer
}>

export type ContextBoundaryViolation = Readonly<{
  file: string
  reason: string
}>

/** Company直下をDDDの4層と横断testだけに限定し、互換directoryの残存を拒否する。 */
export function inspectCompanyRootPath(file: string): ContextBoundaryViolation[] {
  const normalized = file.replaceAll("\\", "/")
  const match = normalized.match(/(?:^|\/)src\/contexts\/company\/([^/]+)/)
  if (match === null) return []

  const rootDirectory = match[1]
  return rootDirectory !== undefined && (isContextLayer(rootDirectory) || rootDirectory === "test")
    ? []
    : [{ file, reason: `Company直下のDDD layerではありません: ${rootDirectory ?? "unknown"}` }]
}

/** Company直下へ置ける領域をmanifestの明示リストへ限定する。 */
export function inspectCompanyAreaPath(file: string): ContextBoundaryViolation[] {
  const normalized = file.replaceAll("\\", "/")
  const match = normalized.match(
    /(?:^|\/)src\/contexts\/company\/(domain|application|infrastructure|interface)\/([^/]+)/,
  )
  if (match === null) return []

  const layer = match[1]
  const area = match[2]
  if (layer === undefined || area === undefined || !isContextLayer(layer)) return []

  if (area.endsWith(".ts")) return []

  return ownershipManifest.companyAreasByLayer[layer].includes(area)
    ? []
    : [{ file, reason: `Company ${layer} の許可領域ではありません: ${area}` }]
}

/** 単一context routeをmanifestで宣言した所有者の下へ固定する。 */
export function inspectRouteOwnershipPath(file: string): ContextBoundaryViolation[] {
  const normalized = file.replaceAll("\\", "/")
  const match = normalized.match(
    /(?:^|\/)src\/contexts\/([^/]+)\/interface\/routes\/([^/]+)(?:\/|$)/,
  )
  if (match === null) return []

  const actualOwner = match[1]
  const routePrefix = match[2]
  if (actualOwner === undefined || routePrefix === undefined) return []

  const expectedOwner = ownershipManifest.routeOwners[routePrefix]
  return expectedOwner === undefined || expectedOwner === actualOwner
    ? []
    : [
        {
          file,
          reason: `route ${routePrefix} の所有者は ${expectedOwner} です: ${actualOwner}`,
        },
      ]
}

/** manifestの所有contextとroute directoryが実在することを検査する。 */
export function inspectOwnershipManifest(): ContextBoundaryViolation[] {
  const violations: ContextBoundaryViolation[] = []
  const owners = new Set(Object.values(ownershipManifest.businessAreaOwners))

  for (const owner of owners) {
    if (!existsSync(resolve(CONTEXTS_ROOT, owner))) {
      violations.push({
        file: "context-ownership.json",
        reason: `business area の所有contextが存在しません: ${owner}`,
      })
    }
  }

  for (const [routePrefix, owner] of Object.entries(ownershipManifest.routeOwners)) {
    if (!existsSync(resolve(CONTEXTS_ROOT, owner, "interface", "routes", routePrefix))) {
      violations.push({
        file: "context-ownership.json",
        reason: `route所有directoryが存在しません: ${owner}/${routePrefix}`,
      })
    }
  }

  for (const routePrefix of ownershipManifest.apiCompositionRoutePrefixes) {
    if (!existsSync(resolve(API_ROOT, "routes", routePrefix))) {
      violations.push({
        file: "context-ownership.json",
        reason: `API composition routeが存在しません: ${routePrefix}`,
      })
    }
  }

  return violations
}

/** API rootをHTTP runtimeの合成責務と製品固有の互換adapterに限定する。 */
export function inspectApiRootPath(file: string): ContextBoundaryViolation[] {
  const normalized = file.replaceAll("\\", "/")
  const match = normalized.match(/(?:^|\/)src\/api\/(.+)$/)

  if (match === null) return []

  const relativePath = match[1]
  if (relativePath === undefined) return []

  const segments = relativePath.split("/")
  const rootEntry = segments[0]

  if (segments.length === 1) {
    return rootEntry !== undefined && API_ROOT_FILES.has(rootEntry)
      ? []
      : [{ file, reason: `API root直下に配置できないファイルです: ${relativePath}` }]
  }

  if (rootEntry === undefined || !API_ROOT_DIRECTORIES.has(rootEntry)) {
    return [{ file, reason: `API rootの責務外ディレクトリです: ${rootEntry ?? relativePath}` }]
  }

  const dddLayer = segments
    .slice(1, -1)
    .find((segment) => CONTEXT_LAYERS.some((layer) => layer === segment))

  return dddLayer === undefined
    ? []
    : [
        {
          file,
          reason: `API rootにDDD layer ${dddLayer} を作らず、所有contextへ配置してください`,
        },
      ]
}

/** 所有者を隠すcomposition・platform rootの再導入を拒否する。 */
export function inspectLegacyRuntimeRootPath(file: string): ContextBoundaryViolation[] {
  const normalized = file.replaceAll("\\", "/")
  const match = normalized.match(/(?:^|\/)src\/(composition|platform)(?:\/|$)/)

  return match === null
    ? []
    : [
        {
          file,
          reason: `${match[1]} rootではなくAPI root、所有context、または中立libへ配置してください`,
        },
      ]
}

/** context横断テストの配置を単数形testへ統一する。 */
export function inspectContextTestDirectory(file: string): ContextBoundaryViolation[] {
  const normalized = file.replaceAll("\\", "/")

  return /(?:^|\/)src\/contexts\/[^/]+\/tests(?:\/|$)/.test(normalized)
    ? [
        {
          file,
          reason: "context横断テストは複数形 tests ではなく単数形 test に配置してください",
        },
      ]
    : []
}

/** Systemへ吸収した汎用概念を独立contextとして再導入させない。 */
export function inspectRetiredContextPath(file: string): ContextBoundaryViolation[] {
  const normalized = file.replaceAll("\\", "/")
  const match = normalized.match(/(?:^|\/)src\/contexts\/([^/]+)(?:\/|$)/)
  const contextName = match?.[1]

  return contextName !== undefined && RETIRED_CONTEXT_NAMES.has(contextName)
    ? [
        {
          file,
          reason: `${contextName} contextは廃止済みです。汎用手続はSystem、資格はCompany、業務payloadは所有contextへ配置してください`,
        },
      ]
    : []
}

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

/** System > Company > 業務の一方向依存だけを許可する。system-compatibilityはSystemと同格の下位提供層で、canonicalなsystem・companyからは利用しない。 */
export function canContextDependOn(sourceContext: string, targetContext: string): boolean {
  if (sourceContext === targetContext) return true
  if (sourceContext === "system") return false
  if (sourceContext === "system-compatibility") return targetContext === "system"
  if (sourceContext === "company") return targetContext === "system"

  if (sourceContext === "company-compatibility") {
    return (
      targetContext === "system" ||
      targetContext === "system-compatibility" ||
      targetContext === "company"
    )
  }
  if (targetContext === "company-compatibility") return true

  return (
    targetContext === "system" ||
    targetContext === "system-compatibility" ||
    targetContext === "company"
  )
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

/** 移行済みのcontext-first sourceと中立libを自動検査する。 */
export async function collectContextBoundaryViolations(): Promise<ContextBoundaryViolation[]> {
  const violations: ContextBoundaryViolation[] = [...inspectOwnershipManifest()]

  if (existsSync(API_ROOT)) {
    for await (const file of new Glob("**/*.{ts,tsx}").scan(API_ROOT)) {
      violations.push(...inspectApiRootPath(relative(PROJECT_ROOT, resolve(API_ROOT, file))))
    }
  }

  for (const legacyRootName of ["composition", "platform"]) {
    const legacyRoot = resolve(SOURCE_ROOT, legacyRootName)
    if (!existsSync(legacyRoot)) continue

    for await (const file of new Glob("**/*.{ts,tsx}").scan(legacyRoot)) {
      violations.push(
        ...inspectLegacyRuntimeRootPath(relative(PROJECT_ROOT, resolve(legacyRoot, file))),
      )
    }
  }

  if (existsSync(CONTEXTS_ROOT)) {
    for await (const file of new Glob("**/*.{ts,tsx}").scan(CONTEXTS_ROOT)) {
      const path = resolve(CONTEXTS_ROOT, file)
      const projectRelativePath = relative(PROJECT_ROOT, path)

      violations.push(...inspectRetiredContextPath(projectRelativePath))
      violations.push(...inspectContextTestDirectory(projectRelativePath))
      violations.push(...inspectCompanyRootPath(projectRelativePath))
      violations.push(...inspectCompanyAreaPath(projectRelativePath))
      violations.push(...inspectRouteOwnershipPath(projectRelativePath))

      if (/\.(?:test|spec)\.tsx?$/.test(file)) continue

      violations.push(...inspectContextSource(projectRelativePath, readFileSync(path, "utf8")))
    }
  }

  if (existsSync(LIB_ROOT)) {
    for await (const file of new Glob("**/*.{ts,tsx}").scan(LIB_ROOT)) {
      const path = resolve(LIB_ROOT, file)
      const projectRelativePath = relative(PROJECT_ROOT, path)

      violations.push(...inspectLibSource(projectRelativePath, readFileSync(path, "utf8")))
    }
  }

  return violations
}

function violationKey(violation: ContextBoundaryViolation): string {
  return JSON.stringify([violation.file, violation.reason])
}

/** 既存lib違反の完全一致だけを許可し、新規違反と解消済みbaselineを拒否する。 */
export function inspectBoundaryBaseline(
  current: ReadonlyArray<ContextBoundaryViolation>,
  baseline: ReadonlyArray<ContextBoundaryViolation>,
): ReadonlyArray<ContextBoundaryViolation> {
  const currentKeys = new Set(current.map(violationKey))
  const baselineKeys = new Set(baseline.map(violationKey))
  const unexpected = current.filter((violation) => !baselineKeys.has(violationKey(violation)))
  const stale = baseline
    .filter((violation) => !currentKeys.has(violationKey(violation)))
    .map((violation) => ({
      file: violation.file,
      reason: `解消済みのlib境界baselineを削除してください: ${violation.reason}`,
    }))

  return [...unexpected, ...stale]
}

/** 現在の境界違反を縮小専用baselineと照合する。 */
export async function checkContextBoundaries(): Promise<ReadonlyArray<ContextBoundaryViolation>> {
  return inspectBoundaryBaseline(await collectContextBoundaryViolations(), LIB_BOUNDARY_BASELINE)
}

if (import.meta.main) {
  const violations = await checkContextBoundaries()

  if (violations.length > 0) {
    for (const violation of violations) console.error(`${violation.file}: ${violation.reason}`)
    process.exit(1)
  }

  console.log("context-first の依存境界を確認しました")
}
