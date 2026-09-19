/**
 * src/api/scheduled/run-*.ts を走査して定期起動の一覧 src/api/scheduled/jobs.ts を生成する。
 *
 *   bun run gen:scheduled         # jobs.ts を上書きする
 *   bun run gen:scheduled --check # 生成結果と現在の jobs.ts を比較する（差分があれば非ゼロ終了）
 *
 * Workerの入口が各runnerを名指しすると、業務contextを外すたびに入口の編集が必要になる。
 * runnerのファイルを消して再生成すれば入口を変えずに外せるよう、一覧を生成物にする。
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import process from "node:process"

const SCHEDULED_ROOT = resolve(import.meta.dir, "../src/api/scheduled")
const JOBS_PATH = resolve(SCHEDULED_ROOT, "jobs.ts")
const RUNNER_FILE_PATTERN = /^run-[a-z0-9-]+\.ts$/u
const RUNNER_EXPORT_PATTERN = /^export async function (runScheduled[A-Za-z0-9]+)\(/gmu

export type ScheduledRunner = Readonly<{ file: string; name: string }>

/** runnerは1ファイルにつき `runScheduled` で始まる関数を一つだけexportする。 */
export function exportedRunner(file: string, source: string): ScheduledRunner | Error {
  const names = [...source.matchAll(RUNNER_EXPORT_PATTERN)].map((match) => match[1] ?? "")
  if (names.length !== 1 || names[0] === undefined || names[0].length === 0)
    return new Error(`${file}: runScheduled で始まる async function を一つだけ export してください`)
  return { file, name: names[0] }
}

export function renderJobs(runners: ReadonlyArray<ScheduledRunner>): string {
  const sorted = runners.toSorted((left, right) => left.file.localeCompare(right.file))
  const imports = sorted.map(
    (runner) =>
      `import { ${runner.name} } from "@/api/scheduled/${runner.file.replace(/\.ts$/u, "")}"`,
  )
  const entries = sorted.map((runner) => `  ${runner.name},`)
  return [
    "// このファイルは `bun run gen:scheduled` が生成する。手で編集しない。",
    ...imports,
    "",
    "/** Workerの定期起動で実行するrunner。src/api/scheduled/run-*.ts から生成する。 */",
    entries.length === 0
      ? "export const SCHEDULED_JOBS = [] as const"
      : ["export const SCHEDULED_JOBS = [", ...entries, "] as const"].join("\n"),
    "",
  ].join("\n")
}

export function collectRunners(): ReadonlyArray<ScheduledRunner> | Error {
  const runners: ScheduledRunner[] = []
  for (const file of readdirSync(SCHEDULED_ROOT).filter((name) => RUNNER_FILE_PATTERN.test(name))) {
    const runner = exportedRunner(file, readFileSync(resolve(SCHEDULED_ROOT, file), "utf8"))
    if (runner instanceof Error) return runner
    runners.push(runner)
  }
  return runners
}

if (import.meta.main) {
  const runners = collectRunners()
  if (runners instanceof Error) {
    console.error(runners.message)
    process.exit(1)
  }
  const rendered = renderJobs(runners)

  if (process.argv.includes("--check")) {
    if (!existsSync(JOBS_PATH) || readFileSync(JOBS_PATH, "utf8") !== rendered) {
      console.error(
        "jobs.ts が src/api/scheduled と一致しません。bun run gen:scheduled を実行してください",
      )
      process.exit(1)
    }
    console.log(`jobs.ts は最新です (${runners.length} runners)`)
  } else {
    writeFileSync(JOBS_PATH, rendered)
    console.log(`jobs.ts を生成しました (${runners.length} runners)`)
  }
}
