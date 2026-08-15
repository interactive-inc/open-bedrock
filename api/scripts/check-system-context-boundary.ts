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
const SYSTEM_CONTEXT_ROOT = resolve(SOURCE_ROOT, "contexts/system")
const LEGACY_CONTEXT_LAYERS = [
  "domain",
  "application",
  "infrastructure",
  "interface/converters",
] as const
const CONTEXT_FIRST_LAYERS = ["domain", "application", "infrastructure", "interface"] as const
const SYSTEM_SELF_REFERENCE_LAYERS = ["application", "domain", "infrastructure"] as const
const SYSTEM_PATH_MAPPING_LAYERS = [...SYSTEM_SELF_REFERENCE_LAYERS, "interface"] as const
const PRODUCT_NEUTRAL_SYSTEM_LAYERS = ["application", "domain", "interface"] as const
const SYSTEM_SCHEMA_PATHS = ["system.ts", "system-core.ts"]
  .flatMap((file) => [
    resolve(SYSTEM_CONTEXT_ROOT, "infrastructure/schema", file),
    resolve(SOURCE_ROOT, "schema", file),
  ])
  .filter(existsSync)
const SYSTEM_IMPLEMENTATION_ROOTS = [SYSTEM_CONTEXT_ROOT, API_SOURCE_ROOT].filter((root) =>
  SYSTEM_SELF_REFERENCE_LAYERS.some((layer) =>
    existsSync(
      isContextFirstSystemRoot(root) ? resolve(root, layer) : resolve(root, layer, "system"),
    ),
  ),
)
const SYSTEM_SELF_REFERENCE_ROOT = SYSTEM_IMPLEMENTATION_ROOTS.includes(SYSTEM_CONTEXT_ROOT)
  ? SYSTEM_CONTEXT_ROOT
  : API_SOURCE_ROOT
const SYSTEM_OWNERSHIP_MANIFEST_PATH = resolve(PROJECT_ROOT, "system-context.manifest.json")
const SYSTEM_CAPABILITY_CATALOG_PATH = existsSync(
  resolve(SYSTEM_CONTEXT_ROOT, "domain/configuration/system-capability.catalog.ts"),
)
  ? resolve(SYSTEM_CONTEXT_ROOT, "domain/configuration/system-capability.catalog.ts")
  : resolve(API_SOURCE_ROOT, "domain/system/configuration/system-capability.catalog.ts")
const SYSTEM_SOURCE_PATHS = [
  ...CONTEXT_FIRST_LAYERS.map((layer) => resolve(SYSTEM_CONTEXT_ROOT, layer)),
  ...LEGACY_CONTEXT_LAYERS.map((layer) => resolve(API_SOURCE_ROOT, layer, "system")),
  ...SYSTEM_SCHEMA_PATHS,
].filter(existsSync)
const PRODUCT_NEUTRAL_SYSTEM_SOURCE_PATHS = new Set(
  PRODUCT_NEUTRAL_SYSTEM_LAYERS.flatMap((layer) => [
    resolve(SYSTEM_CONTEXT_ROOT, layer),
    resolve(API_SOURCE_ROOT, layer, "system"),
  ]),
)
const TYPESCRIPT_CONFIG_PATHS = [
  "tsconfig.json",
  "tsconfig.api.json",
  "tsconfig.app.json",
  "tsconfig.seed.json",
]
  .map((file) => resolve(PROJECT_ROOT, file))
  .filter(existsSync)
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
const GLOBAL_SCHEMA_MODULE = /^@\/api\/database\/schema(?:\/|$)/
const LEGACY_SCHEMA_MODULE = /^@\/schema(?:\/(.*))?$/
const API_ROOT_MODULE =
  /^@\/api\/(?:configuration|context(?:-module\.registry)?|help-assets|iam|index|navigation|orchestration)(?:\/|$)/
const COMPOSITION_MODULE = /^@\/(?:api\/)?composition(?:\/|$)/
const CONTEXT_MODULE =
  /^@\/contexts\/([^/]+)\/(?:domain|application|infrastructure|interface)(?:\/|$)/
const SYSTEM_SELF_REFERENCE_MODULE = /^@system\/(application|domain|infrastructure|interface)\/.+$/

export type SystemBoundaryViolation = Readonly<{
  file: string
  reason: string
}>

function normalizeVocabularyBoundaries(value: string): string {
  return value.replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll(/[_./:-]+/g, " ")
}

function normalizeProductMarkerBoundaries(value: string): string {
  return value.replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll(/[^A-Za-z0-9]+/g, " ")
}

function vocabularySourceOf(node: ts.Node): string | null {
  return ts.isIdentifier(node) ||
    ts.isPrivateIdentifier(node) ||
    ts.isStringLiteralLike(node) ||
    ts.isTemplateLiteralToken(node) ||
    ts.isRegularExpressionLiteral(node)
    ? node.text
    : null
}

function isUnknownRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasExportModifier(node: ts.Node & { modifiers?: ts.NodeArray<ts.ModifierLike> }): boolean {
  return node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false
}

function isContextFirstSystemRoot(sourceRoot: string): boolean {
  return sourceRoot.replaceAll("\\", "/").endsWith("/contexts/system")
}

/** System schema が所有する exported sqliteTable のシンボル名を構文木から集める。 */
export function collectSystemSchemaTableNames(file: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const tableNames: string[] = []
  const sqliteTableIdentifiers = new Set<string>()
  const sqliteCoreNamespaces = new Set<string>()

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteralLike(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "drizzle-orm/sqlite-core"
    ) {
      continue
    }

    const bindings = statement.importClause?.namedBindings

    if (bindings !== undefined && ts.isNamespaceImport(bindings)) {
      sqliteCoreNamespaces.add(bindings.name.text)
      continue
    }

    if (bindings === undefined || !ts.isNamedImports(bindings)) continue

    for (const element of bindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text

      if (importedName === "sqliteTable") sqliteTableIdentifiers.add(element.name.text)
    }
  }

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement) || !hasExportModifier(statement)) continue

    for (const declaration of statement.declarationList.declarations) {
      const initializer = declaration.initializer

      if (
        !ts.isIdentifier(declaration.name) ||
        initializer === undefined ||
        !ts.isCallExpression(initializer) ||
        !(
          (ts.isIdentifier(initializer.expression) &&
            sqliteTableIdentifiers.has(initializer.expression.text)) ||
          (ts.isPropertyAccessExpression(initializer.expression) &&
            ts.isIdentifier(initializer.expression.expression) &&
            sqliteCoreNamespaces.has(initializer.expression.expression.text) &&
            initializer.expression.name.text === "sqliteTable")
        )
      ) {
        continue
      }

      tableNames.push(declaration.name.text)
    }
  }

  return tableNames.toSorted()
}

/** application/domain/infrastructure の System 直下にある capability namespace を集める。 */
export function discoverSystemCapabilityNames(
  apiSourceRoots: string | ReadonlyArray<string> = SYSTEM_IMPLEMENTATION_ROOTS,
): ReadonlySet<string> {
  const capabilities = new Set<string>()
  const roots = typeof apiSourceRoots === "string" ? [apiSourceRoots] : apiSourceRoots

  for (const sourceRoot of roots) {
    for (const layer of SYSTEM_SELF_REFERENCE_LAYERS) {
      const systemRoot = isContextFirstSystemRoot(sourceRoot)
        ? resolve(sourceRoot, layer)
        : resolve(sourceRoot, layer, "system")

      if (!existsSync(systemRoot)) continue

      for (const entry of readdirSync(systemRoot, { withFileTypes: true })) {
        if (layer === "infrastructure" && entry.name === "schema") continue
        if (entry.isDirectory()) capabilities.add(entry.name)
      }
    }
  }

  return capabilities
}

export function inspectSystemCapabilityRootEntries(
  file: string,
  entries: Iterable<Readonly<{ name: string; isDirectory: boolean }>>,
): SystemBoundaryViolation[] {
  return [...entries]
    .filter(
      (entry) =>
        !entry.isDirectory &&
        /\.tsx?$/.test(entry.name) &&
        !/\.(?:test|spec)\.tsx?$/.test(entry.name),
    )
    .map((entry) => ({
      file: `${file}/${entry.name}`,
      reason: "System production source は宣言済み capability namespace 配下へ置いてください",
    }))
}

function inspectSystemCapabilityLayout(
  apiSourceRoots: string | ReadonlyArray<string> = SYSTEM_IMPLEMENTATION_ROOTS,
): SystemBoundaryViolation[] {
  const violations: SystemBoundaryViolation[] = []
  const roots = typeof apiSourceRoots === "string" ? [apiSourceRoots] : apiSourceRoots

  for (const sourceRoot of roots) {
    for (const layer of SYSTEM_SELF_REFERENCE_LAYERS) {
      const systemRoot = isContextFirstSystemRoot(sourceRoot)
        ? resolve(sourceRoot, layer)
        : resolve(sourceRoot, layer, "system")

      if (!existsSync(systemRoot)) continue

      violations.push(
        ...inspectSystemCapabilityRootEntries(
          relative(PROJECT_ROOT, systemRoot),
          readdirSync(systemRoot, { withFileTypes: true }).map((entry) => ({
            name: entry.name,
            isDirectory: entry.isDirectory(),
          })),
        ),
      )
    }
  }

  return violations
}

function inspectSortedUniqueStringList(
  file: string,
  field: string,
  value: unknown,
  pattern: RegExp,
): { values: string[]; violations: SystemBoundaryViolation[] } {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    return {
      values: [],
      violations: [{ file, reason: `${field} は文字列配列で宣言してください` }],
    }
  }

  const values = value as string[]

  if (values.some((entry) => !pattern.test(entry))) {
    return {
      values,
      violations: [{ file, reason: `${field} に不正な名前があります` }],
    }
  }

  if (new Set(values).size !== values.length) {
    return {
      values,
      violations: [{ file, reason: `${field} に重複があります` }],
    }
  }

  if (values.some((entry, index) => index > 0 && (values[index - 1] ?? "") > entry)) {
    return {
      values,
      violations: [{ file, reason: `${field} は昇順で宣言してください` }],
    }
  }

  return { values, violations: [] }
}

export function inspectSystemCapabilityCatalog(
  file: string,
  source: string,
): { capabilities: string[]; violations: SystemBoundaryViolation[] } {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const declarations: ts.VariableDeclaration[] = []

  for (const statement of sourceFile.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) !==
        true
    ) {
      continue
    }

    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "SYSTEM_CAPABILITY_NAMES"
      ) {
        declarations.push(declaration)
      }
    }
  }

  if (declarations.length !== 1) {
    return {
      capabilities: [],
      violations: [
        { file, reason: "SYSTEM_CAPABILITY_NAMES はexport constで1件だけ宣言してください" },
      ],
    }
  }

  const declaration = declarations[0]
  const declarationList = declaration?.parent
  const declarationInitializer = declaration?.initializer

  if (
    declarationList === undefined ||
    !ts.isVariableDeclarationList(declarationList) ||
    (declarationList.flags & ts.NodeFlags.Const) === 0 ||
    declarationInitializer === undefined ||
    !isConstAssertion(declarationInitializer)
  ) {
    return {
      capabilities: [],
      violations: [
        { file, reason: "SYSTEM_CAPABILITY_NAMES はexport constのconst assertionにしてください" },
      ],
    }
  }

  const initializer = unwrapExpression(declarationInitializer)

  if (
    initializer === undefined ||
    !ts.isArrayLiteralExpression(initializer) ||
    initializer.elements.some((element) => !ts.isStringLiteralLike(element))
  ) {
    return {
      capabilities: [],
      violations: [
        { file, reason: "SYSTEM_CAPABILITY_NAMES は文字列array literalで宣言してください" },
      ],
    }
  }

  const inspected = inspectSortedUniqueStringList(
    file,
    "SYSTEM_CAPABILITY_NAMES",
    initializer.elements.map((element) => (element as ts.StringLiteralLike).text),
    /^[a-z][a-z0-9-]*$/,
  )

  return { capabilities: inspected.values, violations: inspected.violations }
}

function isConstAssertion(expression: ts.Expression): boolean {
  return (
    ts.isAsExpression(expression) &&
    ts.isTypeReferenceNode(expression.type) &&
    ts.isIdentifier(expression.type.typeName) &&
    expression.type.typeName.text === "const"
  )
}

function unwrapExpression(expression: ts.Expression | undefined): ts.Expression | undefined {
  let current = expression

  while (
    current !== undefined &&
    (ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current))
  ) {
    current = current.expression
  }

  return current
}

/**
 * System の拡張責務を明示した manifest と実装を完全一致で検査する。
 * 正当な拡張は manifest と実装を同じ変更で更新し、暗黙の責務追加だけを fail closed にする。
 */
export function inspectSystemOwnershipManifest(
  file: string,
  manifest: unknown,
  actualCapabilities: Iterable<string>,
  actualSchemaTables: Iterable<string>,
  canonicalCapabilities: Iterable<string>,
): SystemBoundaryViolation[] {
  if (!isUnknownRecord(manifest)) {
    return [{ file, reason: "System ownership manifest は object で宣言してください" }]
  }

  const expectedFields = [
    "forbiddenProductMarkers",
    "implementedCapabilities",
    "schemaTables",
    "targetCapabilities",
    "version",
  ]
  const actualFields = Object.keys(manifest).toSorted()

  if (
    actualFields.length !== expectedFields.length ||
    actualFields.some((field, index) => field !== expectedFields[index])
  ) {
    return [{ file, reason: `manifest field は ${expectedFields.join(", ")} だけを許可します` }]
  }

  if (manifest.version !== 2) {
    return [{ file, reason: "System ownership manifest の version は 2 だけを許可します" }]
  }

  const implementedCapabilities = inspectSortedUniqueStringList(
    file,
    "implementedCapabilities",
    manifest.implementedCapabilities,
    /^[a-z][a-z0-9-]*$/,
  )
  const forbiddenProductMarkers = inspectSortedUniqueStringList(
    file,
    "forbiddenProductMarkers",
    manifest.forbiddenProductMarkers,
    /^[a-z][a-z0-9]*$/,
  )
  const schemaTables = inspectSortedUniqueStringList(
    file,
    "schemaTables",
    manifest.schemaTables,
    /^[a-z][A-Za-z0-9]*$/,
  )
  const targetCapabilities = inspectSortedUniqueStringList(
    file,
    "targetCapabilities",
    manifest.targetCapabilities,
    /^[a-z][a-z0-9-]*$/,
  )
  const violations = [
    ...implementedCapabilities.violations,
    ...forbiddenProductMarkers.violations,
    ...schemaTables.violations,
    ...targetCapabilities.violations,
  ]

  if (violations.length > 0) return violations

  const declaredImplementedCapabilities = new Set(implementedCapabilities.values)
  const actualImplementedCapabilities = new Set(actualCapabilities)
  const declaredTargetCapabilities = new Set(targetCapabilities.values)
  const canonicalTargetCapabilities = new Set(canonicalCapabilities)
  const declaredSchemaTables = new Set(schemaTables.values)
  const implementedSchemaTables = new Set(actualSchemaTables)

  for (const capability of [...actualImplementedCapabilities].toSorted()) {
    if (!declaredImplementedCapabilities.has(capability)) {
      violations.push({ file, reason: `未宣言の System capability です: ${capability}` })
    }
  }

  for (const capability of implementedCapabilities.values) {
    if (!actualImplementedCapabilities.has(capability)) {
      violations.push({ file, reason: `実装がない System capability 宣言です: ${capability}` })
    }
  }

  for (const capability of [...canonicalTargetCapabilities].toSorted()) {
    if (!declaredTargetCapabilities.has(capability)) {
      violations.push({
        file,
        reason: `targetCapabilities に共通 capability がありません: ${capability}`,
      })
    }
  }

  for (const capability of targetCapabilities.values) {
    if (!canonicalTargetCapabilities.has(capability)) {
      violations.push({
        file,
        reason: `targetCapabilities にcatalog外の capability があります: ${capability}`,
      })
    }
  }

  for (const capability of implementedCapabilities.values) {
    if (!declaredTargetCapabilities.has(capability)) {
      violations.push({ file, reason: `実装 capability が共通targetにありません: ${capability}` })
    }
  }

  for (const table of [...implementedSchemaTables].toSorted()) {
    if (!declaredSchemaTables.has(table)) {
      violations.push({ file, reason: `未宣言の System schema table です: ${table}` })
    }
  }

  for (const table of schemaTables.values) {
    if (!implementedSchemaTables.has(table)) {
      violations.push({ file, reason: `実装がない System schema table 宣言です: ${table}` })
    }
  }

  return violations
}

export function inspectSystemSelfReferencePathMappings(
  file: string,
  pathMappings: unknown,
  apiSourceRoot: string,
): SystemBoundaryViolation[] {
  if (!isUnknownRecord(pathMappings)) {
    return [{ file, reason: "System self-reference の path mapping がありません" }]
  }

  const normalizedSourceRoot = apiSourceRoot.replaceAll("\\", "/")
  const violations: SystemBoundaryViolation[] = []

  for (const layer of SYSTEM_PATH_MAPPING_LAYERS) {
    const alias = `@system/${layer}/*`
    const expectedPath = normalizedSourceRoot.endsWith("contexts/system")
      ? `./${normalizedSourceRoot}/${layer}/*`
      : `./${normalizedSourceRoot}/${layer}/system/*`
    const configuredPaths = pathMappings[alias]
    const isExpectedMapping =
      Array.isArray(configuredPaths) &&
      configuredPaths.length === 1 &&
      configuredPaths[0] === expectedPath

    if (!isExpectedMapping) {
      violations.push({
        file,
        reason: `${alias} を System 所有 path ${expectedPath} だけへ対応づけてください`,
      })
    }
  }

  return violations
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

  const contextRoots = new Set([resolve(apiSourceRoot, "contexts")])
  if (apiSourceRoot === API_SOURCE_ROOT) contextRoots.add(resolve(SOURCE_ROOT, "contexts"))

  for (const contextsRoot of contextRoots) {
    if (!existsSync(contextsRoot)) continue

    for (const entry of readdirSync(contextsRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) directoryNames.push(entry.name)
    }
  }

  for (const layer of LEGACY_CONTEXT_LAYERS) {
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

  if (API_ROOT_MODULE.test(moduleSpecifier)) {
    return [{ file, reason: `System から API root へ依存しています: ${moduleSpecifier}` }]
  }

  if (moduleSpecifier === "@/env") {
    return [{ file, reason: "System から製品全体の実行時 Context へ依存しています: @/env" }]
  }

  if (COMPOSITION_MODULE.test(moduleSpecifier)) {
    return [{ file, reason: `System から composition へ依存しています: ${moduleSpecifier}` }]
  }

  if (GLOBAL_SCHEMA_MODULE.test(moduleSpecifier)) {
    return [{ file, reason: `System から全体DB schema合成へ依存しています: ${moduleSpecifier}` }]
  }

  if (moduleSpecifier.startsWith("@system/")) {
    return SYSTEM_SELF_REFERENCE_MODULE.test(moduleSpecifier)
      ? []
      : [{ file, reason: `未定義の System self-reference です: ${moduleSpecifier}` }]
  }

  const contextModule = moduleSpecifier.match(CONTEXT_MODULE)

  if (contextModule !== null) {
    const contextName = contextModule[1] ?? ""

    return contextName === "system"
      ? []
      : [{ file, reason: `System から下位コンテキストへ依存しています: ${moduleSpecifier}` }]
  }

  const schemaModule = moduleSpecifier.match(LEGACY_SCHEMA_MODULE)

  if (schemaModule !== null) {
    const importedPath = schemaModule[1] ?? ""
    const isSystemSchema =
      importedPath === "system" ||
      importedPath.startsWith("system/") ||
      importedPath === "system-core"

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
  forbiddenProductMarkers: ReadonlySet<string> = new Set(),
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
  let forbiddenProductMarker: string | undefined

  function visit(node: ts.Node): void {
    const vocabularySource = vocabularySourceOf(node)
    const matchedVocabulary =
      vocabularySource === null
        ? undefined
        : normalizeVocabularyBoundaries(vocabularySource).match(FORBIDDEN_VOCABULARY)?.[0]
    const matchedProductMarker =
      vocabularySource === null
        ? undefined
        : normalizeProductMarkerBoundaries(vocabularySource)
            .toLowerCase()
            .split(/\s+/)
            .find((token) => forbiddenProductMarkers.has(token))

    if (forbiddenVocabulary === undefined && matchedVocabulary !== undefined) {
      forbiddenVocabulary = matchedVocabulary
    }

    if (forbiddenProductMarker === undefined && matchedProductMarker !== undefined) {
      forbiddenProductMarker = matchedProductMarker
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

  if (forbiddenProductMarker !== undefined) {
    violations.unshift({
      file,
      reason: `System core に製品 marker "${forbiddenProductMarker}" があります`,
    })
  }

  return violations
}

async function inspectSystemPath(
  path: string,
  downstreamContexts: ReadonlySet<string>,
  forbiddenProductMarkers: ReadonlySet<string>,
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
      forbiddenProductMarkers,
    ),
  )
}

function readForbiddenProductMarkers(): ReadonlySet<string> {
  try {
    const manifest: unknown = JSON.parse(readFileSync(SYSTEM_OWNERSHIP_MANIFEST_PATH, "utf8"))

    return isUnknownRecord(manifest) &&
      Array.isArray(manifest.forbiddenProductMarkers) &&
      manifest.forbiddenProductMarkers.every((marker) => typeof marker === "string")
      ? new Set(manifest.forbiddenProductMarkers)
      : new Set()
  } catch {
    return new Set()
  }
}

function inspectTypeScriptConfig(path: string): SystemBoundaryViolation[] {
  const file = relative(PROJECT_ROOT, path)
  let configuration: unknown

  try {
    configuration = JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return [{ file, reason: "TypeScript 設定を解析できません" }]
  }

  const compilerOptions = isUnknownRecord(configuration) ? configuration.compilerOptions : null
  const pathMappings = isUnknownRecord(compilerOptions) ? compilerOptions.paths : null

  return inspectSystemSelfReferencePathMappings(
    file,
    pathMappings,
    relative(PROJECT_ROOT, SYSTEM_SELF_REFERENCE_ROOT),
  )
}

function inspectSystemOwnership(): SystemBoundaryViolation[] {
  const file = relative(PROJECT_ROOT, SYSTEM_OWNERSHIP_MANIFEST_PATH)
  let manifest: unknown

  try {
    manifest = JSON.parse(readFileSync(SYSTEM_OWNERSHIP_MANIFEST_PATH, "utf8"))
  } catch {
    return [{ file, reason: "System ownership manifest を解析できません" }]
  }

  const schemaTables = SYSTEM_SCHEMA_PATHS.flatMap((path) =>
    collectSystemSchemaTableNames(relative(PROJECT_ROOT, path), readFileSync(path, "utf8")),
  )
  const catalogFile = relative(PROJECT_ROOT, SYSTEM_CAPABILITY_CATALOG_PATH)
  const catalog = existsSync(SYSTEM_CAPABILITY_CATALOG_PATH)
    ? inspectSystemCapabilityCatalog(
        catalogFile,
        readFileSync(SYSTEM_CAPABILITY_CATALOG_PATH, "utf8"),
      )
    : {
        capabilities: [],
        violations: [{ file: catalogFile, reason: "System capability catalog がありません" }],
      }

  return [
    ...catalog.violations,
    ...inspectSystemOwnershipManifest(
      file,
      manifest,
      discoverSystemCapabilityNames(),
      schemaTables,
      catalog.capabilities,
    ),
  ]
}

export async function checkSystemContextBoundary(): Promise<SystemBoundaryViolation[]> {
  const downstreamContexts = discoverDownstreamContexts()
  const forbiddenProductMarkers = readForbiddenProductMarkers()
  const violations: SystemBoundaryViolation[] = [
    ...inspectSystemOwnership(),
    ...inspectSystemCapabilityLayout(),
  ]

  for (const path of SYSTEM_SOURCE_PATHS) {
    violations.push(
      ...(await inspectSystemPath(
        path,
        downstreamContexts,
        PRODUCT_NEUTRAL_SYSTEM_SOURCE_PATHS.has(path) ? forbiddenProductMarkers : new Set(),
      )),
    )
  }

  for (const path of TYPESCRIPT_CONFIG_PATHS) {
    violations.push(...inspectTypeScriptConfig(path))
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
