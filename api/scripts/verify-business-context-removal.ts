import { Glob } from "bun"
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import process from "node:process"

const PROJECT_ROOT = resolve(import.meta.dir, "..")

/** 所有contextの宣言を束ねるだけのファイル。業務を外すときは該当行だけを除く。 */
const AGGREGATE_FILES = [
  "src/schema.ts",
  "src/api/http/permissions/permission.catalog.ts",
  "src/api/http/permissions/permission-key.catalog.ts",
  "src/api/http/permissions/business-permission-key.catalog.ts",
] as const
const REGISTRY_FILE = "src/api/route-module.registry.ts"
const GENERATED_FILES = ["src/api/app.ts", "src/api/scheduled/jobs.ts"] as const
/**
 * 一覧を生成するため、対象contextと一緒にファイルごと外せるcomposition。
 * 複数の業務を束ねるrouteは、束ねる業務の一つが無くなれば成立しないので一緒に外す。
 */
const REMOVABLE_COMPOSITION_PATTERN =
  /^src\/api\/(?:scheduled\/run-[a-z0-9-]+|routes\/[a-z0-9.$-]+?(?:\.test)?)\.ts$/iu

export function isRemovableComposition(file: string): boolean {
  return REMOVABLE_COMPOSITION_PATTERN.test(file)
}

export type AggregateRemoval = Readonly<{ source: string; identifiers: ReadonlyArray<string> }>

/**
 * 束ねるだけのファイルから、対象contextのimportと、そのidentifierだけを置いた行を除く。
 * identifierが他の式に残る場合は機械的に外せないため、呼び出し側が失敗として扱う。
 */
export function removeContextFromAggregate(source: string, context: string): AggregateRemoval {
  const identifiers: string[] = []
  const importPattern = new RegExp(
    `^import (?:\\* as (\\w+)|\\{([^}]+)\\}) from "@/contexts/${context}/[^"]+"\\n`,
    "gmu",
  )
  const withoutImports = source.replace(importPattern, (_, namespace, named) => {
    if (typeof namespace === "string") identifiers.push(namespace)
    if (typeof named === "string")
      identifiers.push(
        ...named
          .split(",")
          .map(
            (name) =>
              name
                .trim()
                .split(/\s+as\s+/u)
                .at(-1) ?? "",
          )
          .filter((name) => name.length > 0),
      )
    return ""
  })
  const kept = withoutImports.split("\n").filter((line) => {
    const entry = line.trim()
    return !identifiers.some(
      (identifier) =>
        entry === `...${identifier},` ||
        new RegExp(`^(?:"[a-z-]+"|[a-z]+): ${identifier},$`, "u").test(entry),
    )
  })
  return { source: kept.join("\n"), identifiers }
}

/**
 * 対象contextの外にあり、束ねるだけのファイルでも生成物でもないのに対象を名指しするsource。
 * scriptsは検査用の文字列fixtureとしてcontext名を含むため走査しない。
 */
export async function listCompositionDependents(root: string, context: string): Promise<string[]> {
  const dependents: string[] = []
  const ignored = new Set<string>([...AGGREGATE_FILES, ...GENERATED_FILES])
  for await (const file of new Glob("{src,tests}/**/*.{ts,tsx}").scan(root)) {
    if (file.startsWith(`src/contexts/${context}/`) || ignored.has(file)) continue
    if (readFileSync(join(root, file), "utf8").includes(`@/contexts/${context}/`))
      dependents.push(file)
  }
  return dependents.toSorted()
}

/**
 * 対象を名指しするcompositionのうち、対象と一緒に外せるものを求める。
 * API rootのhelperは、import元がすべて一緒に外れる場合に限って外せる。
 */
export async function partitionDependents(
  root: string,
  dependents: ReadonlyArray<string>,
): Promise<{ removable: string[]; blocking: string[] }> {
  const removable = new Set(dependents.filter((file) => isRemovableComposition(file)))
  const sources = new Map<string, string>()
  for await (const file of new Glob("{src,tests}/**/*.{ts,tsx}").scan(root))
    sources.set(file, readFileSync(join(root, file), "utf8"))
  let changed = true
  while (changed) {
    changed = false
    for (const file of dependents) {
      if (removable.has(file) || !file.startsWith("src/api/http/")) continue
      const specifier = `"@/${file.slice("src/".length).replace(/\.tsx?$/u, "")}"`
      const importers = [...sources].filter(([, text]) => text.includes(specifier)).map(([f]) => f)
      if (importers.length > 0 && importers.every((importer) => removable.has(importer))) {
        removable.add(file)
        changed = true
      }
    }
  }
  return {
    removable: [...removable].toSorted(),
    blocking: dependents.filter((file) => !removable.has(file)),
  }
}

function run(command: string[], cwd: string): { ok: boolean; output: string } {
  const result = Bun.spawnSync(command, { cwd, stdout: "pipe", stderr: "pipe" })
  return {
    ok: result.exitCode === 0,
    output: `${result.stdout.toString()}${result.stderr.toString()}`,
  }
}

/**
 * 業務contextのディレクトリとroute登録を外した構成で、基盤と他の業務のproduction sourceが無変更で型検査を通ることを実行で確かめる。
 * 実ツリーは変更せず、一時コピーで検証する。
 */
export async function verifyBusinessContextRemoval(context: string): Promise<string[]> {
  const dependents = await listCompositionDependents(PROJECT_ROOT, context)
  const { removable, blocking } = await partitionDependents(PROJECT_ROOT, dependents)
  if (blocking.length > 0)
    return blocking.map((file) => `${context}: 同時に外すcompositionが残っています: ${file}`)

  const workspace = mkdtempSync(join(tmpdir(), "business-context-removal-"))
  try {
    for (const entry of ["src", "tests", "scripts", "tsconfig.json", "package.json"])
      cpSync(join(PROJECT_ROOT, entry), join(workspace, entry), { recursive: true })
    for (const entry of ["vite.config.ts", "context-ownership.json"])
      cpSync(join(PROJECT_ROOT, entry), join(workspace, entry))
    symlinkSync(join(PROJECT_ROOT, "node_modules"), join(workspace, "node_modules"))

    rmSync(join(workspace, "src", "contexts", context), { recursive: true })
    const registryPath = join(workspace, REGISTRY_FILE)
    const registry = readFileSync(registryPath, "utf8")
    const registryWithout = registry.replace(`  "${context}",\n`, "")
    if (registryWithout === registry) return [`${context}: route登録が見つかりません`]
    writeFileSync(registryPath, registryWithout)

    const failures: string[] = []
    for (const file of AGGREGATE_FILES) {
      const path = join(workspace, file)
      const removal = removeContextFromAggregate(readFileSync(path, "utf8"), context)
      for (const identifier of removal.identifiers) {
        if (new RegExp(`\\b${identifier}\\b`, "u").test(removal.source))
          failures.push(`${context}: ${file} に ${identifier} の参照が残ります`)
      }
      writeFileSync(path, removal.source)
    }
    if (failures.length > 0) return failures

    for (const file of removable) rmSync(join(workspace, file))
    for (const generator of ["scripts/gen-app.ts", "scripts/gen-scheduled.ts"]) {
      const generated = run(["bun", "run", generator], workspace)
      if (!generated.ok) return [`${context}: 再生成に失敗しました\n${generated.output}`]
    }
    // Workerの入口から到達するproduction sourceだけを検査する。共有テスト支援は対象にしない。
    writeFileSync(
      join(workspace, "tsconfig.removal.json"),
      JSON.stringify({ extends: "./tsconfig.json", include: ["src/index.ts", "src/api/app.ts"] }),
    )
    const checked = run(["bunx", "tsc", "--noEmit", "-p", "tsconfig.removal.json"], workspace)
    if (!checked.ok) return [`${context}: 除去後の型検査に失敗しました\n${checked.output}`]
    return []
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  const contexts = process.argv.slice(2)
  if (contexts.length === 0) {
    console.error("usage: bun run scripts/verify-business-context-removal.ts <context>...")
    process.exit(2)
  }
  const failures: string[] = []
  for (const context of contexts) failures.push(...(await verifyBusinessContextRemoval(context)))

  if (failures.length > 0) {
    for (const failure of failures) console.error(failure)
    process.exit(1)
  }
  console.log(`業務contextを外した構成の型検査に成功しました: ${contexts.join(", ")}`)
}
