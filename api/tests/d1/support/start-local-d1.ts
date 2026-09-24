import { splitSqlStatements } from "@/lib/database/split-sql-statements"
import { Miniflare } from "miniflare"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

export type LocalD1 = Readonly<{
  database: (name: string) => Promise<D1Database>
  dispose: () => Promise<void>
}>

const migrationsDirectory = join(import.meta.dir, "../../../migrations")

let migrationStatements: ReadonlyArray<ReadonlyArray<string>> | null = null

/**
 * Cloudflare提供のローカルD1エミュレーター（Miniflare）を起動する。
 * 本番D1そのものではない。名前ごとに独立したインメモリDBを持ち、永続化しない。
 * Worker scriptは外向き通信を持たず、outboundも拒否する。
 */
export async function startLocalD1(names: ReadonlyArray<string>): Promise<LocalD1> {
  const runtime = new Miniflare({
    modules: true,
    script: "export default {}",
    d1Databases: Object.fromEntries(names.map((name) => [name, `local-d1-test-${name}`])),
    outboundService: () => new Response("outbound is disabled in local D1 tests", { status: 503 }),
  })

  await runtime.ready

  return {
    // Miniflare の D1Database は workers-types と同形の別宣言のため、境界で一度だけ読み替える。
    database: async (name) => (await runtime.getD1Database(name)) as unknown as D1Database,
    dispose: () => runtime.dispose(),
  }
}

/** migrations/ を番号順に、ファイル単位のbatchで適用する。 */
export async function applyMigrations(database: D1Database): Promise<void> {
  for (const statements of loadMigrationStatements()) {
    if (statements.length === 0) continue
    await database.batch(statements.map((statement) => database.prepare(statement)))
  }
}

function loadMigrationStatements(): ReadonlyArray<ReadonlyArray<string>> {
  if (migrationStatements !== null) return migrationStatements

  migrationStatements = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => splitSqlStatements(readFileSync(join(migrationsDirectory, file), "utf8")))

  return migrationStatements
}
