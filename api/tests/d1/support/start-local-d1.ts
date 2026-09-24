import { splitSqlStatements } from "@/lib/database/split-sql-statements"
import { Miniflare } from "miniflare"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"

export type LocalD1 = Readonly<{
  database: (name: string) => Promise<D1Database>
  dispose: () => Promise<void>
}>

export type LocalD1Databases = Readonly<{
  /** migrationを適用していない空のDB。D1契約やmigration途中の検証に使う。 */
  empty?: ReadonlyArray<string>
  /** 全migration適用済みtemplateの独立した複製。Repository・SQL・HTTP入口の検証に使う。 */
  migrated?: ReadonlyArray<string>
}>

type Template = Readonly<{
  directory: string
  file: string
  objectCount: number
  /** 複製先の database id ごとの、Miniflareが割り当てるSQLiteファイル名。 */
  slotFiles: ReadonlyArray<string>
}>

const migrationsDirectory = join(import.meta.dir, "../../../migrations")

/** Miniflareが D1 の Durable Object を永続化する、persist directory 内の相対位置。 */
const D1_OBJECT_DIRECTORY = join("d1", "miniflare-D1DatabaseObject")

const TEMPLATE_BINDING = "TEMPLATE"

/**
 * 1ファイルで宣言できるmigration済みDBの上限。複製先の database id を固定の枠にし、
 * そのSQLiteファイル名をtemplate作成時に一度だけ調べる。
 */
const MIGRATED_SLOT_COUNT = 64

let migrationStatements: ReadonlyArray<ReadonlyArray<string>> | null = null

let template: Promise<Template> | null = null

let scratchRoot: string | null = null

/**
 * Cloudflare提供のローカルD1エミュレーター（Miniflare）を起動する。本番D1そのものではない。
 * 宣言した名前ごとに独立したDBを1つのMiniflareに載せ、testの間でDBを共有しない。
 *
 * migration済みDBは、プロセスで一度だけ全migrationを適用したtemplateのSQLiteファイルを、
 * 起動前に各DBのファイル位置へ複製して用意する。数百のmigrationをDBごとに再生せず、
 * workerdの起動もファイルごとに1回にする。
 * 複製後はtemplateと同じschema object数かを検査し、Miniflareの保存形式が変わったら失敗させる。
 * Worker scriptは外向き通信を持たず、outboundも拒否する。
 */
export async function startLocalD1(databases: LocalD1Databases): Promise<LocalD1> {
  const empty = databases.empty ?? []
  const migrated = databases.migrated ?? []
  const names = [...empty, ...migrated]

  if (new Set(names).size !== names.length) {
    throw new Error("local D1 names must be distinct; give each test its own database")
  }

  if (migrated.length > MIGRATED_SLOT_COUNT) {
    throw new Error(`declare at most ${MIGRATED_SLOT_COUNT} migrated local D1 databases per file`)
  }

  const ids: Record<string, string> = {
    ...Object.fromEntries(empty.map((name) => [name, `local-d1-test-${name}`])),
    ...Object.fromEntries(migrated.map((name, index) => [name, slotIdFor(index)])),
  }

  const source = migrated.length > 0 ? await buildTemplate() : null

  /** 起動のたびに新しいディレクトリへtemplateを複製し、失敗した起動とファイルを共有しない。 */
  const preparePersist = (): string => {
    const persist = join(scratchDirectory(), `run-${crypto.randomUUID()}`)
    if (source === null) return persist
    mkdirSync(join(persist, D1_OBJECT_DIRECTORY), { recursive: true })
    migrated.forEach((_, index) => {
      const slotFile = source.slotFiles[index]
      if (slotFile === undefined) throw new Error(`local D1 slot ${index} has no discovered file`)
      copyDatabaseFile(
        join(source.directory, D1_OBJECT_DIRECTORY, source.file),
        join(persist, D1_OBJECT_DIRECTORY, slotFile),
      )
    })
    return persist
  }

  const { runtime, persist } = await startRuntime(preparePersist, ids)

  const migratedNames = new Set(migrated)
  const verified = new Set<string>()

  return {
    database: async (name) => {
      if (!(name in ids)) throw new Error(`local D1 "${name}" was not declared in startLocalD1`)
      // Miniflare の D1Database は workers-types と同形の別宣言のため、境界で一度だけ読み替える。
      const database = (await runtime.getD1Database(name)) as unknown as D1Database
      if (migratedNames.has(name) && !verified.has(name)) {
        await verifyCopy(name, database)
        verified.add(name)
      }
      return database
    },
    dispose: async () => {
      await runtime.dispose()
      rmSync(persist, { recursive: true, force: true })
    },
  }
}

function slotIdFor(index: number): string {
  return `local-d1-test-migrated-slot-${index}`
}

/** workerd の起動が失敗した時に作り直す回数。 */
const RUNTIME_START_ATTEMPTS = 3

/**
 * 1プロセスで多数のファイルを流すと、Bunが workerd を起動する子プロセスのpipeで
 * EBADF や ENOENT を返し、起動が失敗することがある。その失敗に限って起動を作り直す。
 * 作り直しは毎回新しいディレクトリを使い、失敗した起動のworkerdとDBファイルを共有しない。
 * 起動が遅いだけの場合は待ち続け、同じDBファイルへ2つのworkerdを向けない。
 */
async function startRuntime(
  preparePersist: () => string,
  d1Databases: Record<string, string>,
): Promise<{ runtime: Miniflare; persist: string }> {
  for (let attempt = 1; ; attempt++) {
    const persist = preparePersist()
    const runtime = createRuntime(persist, d1Databases)
    try {
      await runtime.ready
      return { runtime, persist }
    } catch (error) {
      console.warn(`local D1 runtime failed to start (attempt ${attempt}):`, error)
      await runtime.dispose().catch(() => undefined)
      rmSync(persist, { recursive: true, force: true })
      if (attempt >= RUNTIME_START_ATTEMPTS) throw error
    }
  }
}

function createRuntime(persist: string, d1Databases: Record<string, string>): Miniflare {
  return new Miniflare({
    modules: true,
    script: "export default {}",
    resourcePersistencePath: persist,
    d1Databases,
    outboundService: () => new Response("outbound is disabled in local D1 tests", { status: 503 }),
    // 実行中にworkerdが落ちるとMiniflareは作り直し、それ以前に得たDBは使えなくなる。原因を追えるよう記録する。
    unsafeHandleRuntimeRestart: () => {
      console.warn(
        "local D1 runtime restarted after an unexpected exit; earlier databases are invalid",
      )
    },
  })
}

/**
 * 全migrationを一度だけ永続化DBへ適用する。
 * 実行環境を閉じてから複製するため、WALを含むファイル一式が静止した状態で使われる。
 */
function buildTemplate(): Promise<Template> {
  if (template !== null) return template

  template = (async () => {
    const directory = join(scratchDirectory(), "template")
    const objectDirectory = join(directory, D1_OBJECT_DIRECTORY)
    const slots = Array.from({ length: MIGRATED_SLOT_COUNT }, (_, index) => slotIdFor(index))
    const runtime = createRuntime(directory, {
      [TEMPLATE_BINDING]: "local-d1-test-template",
      ...Object.fromEntries(slots.map((id, index) => [`SLOT_${index}`, id])),
    })
    let objectCount: number
    const slotFiles: string[] = []
    try {
      const database = (await runtime.getD1Database(TEMPLATE_BINDING)) as unknown as D1Database
      await applyMigrations(database)
      objectCount = await countSchemaObjects(database)
      // 枠のDBを1つずつ開き、Miniflareが作ったファイル名を記録する。ファイル名はidから決まる。
      for (const index of slots.keys()) {
        const before = new Set(databaseFiles(objectDirectory))
        const slot = (await runtime.getD1Database(`SLOT_${index}`)) as unknown as D1Database
        await slot.prepare("SELECT 1").run()
        const created = databaseFiles(objectDirectory).filter((file) => !before.has(file))
        const file = created.at(0)
        if (created.length !== 1 || file === undefined) {
          throw new Error(`could not locate the persisted file of local D1 slot ${index}`)
        }
        slotFiles.push(file)
      }
    } finally {
      await runtime.dispose()
    }
    const files = databaseFiles(objectDirectory).filter((file) => !slotFiles.includes(file))
    const file = files.at(0)
    if (files.length !== 1 || file === undefined) {
      throw new Error(`expected one persisted template database, found ${files.length}`)
    }
    return { directory, file, objectCount, slotFiles }
  })()

  // 失敗したtemplateを再利用せず、次の呼び出しで作り直す。
  template.catch(() => {
    template = null
  })

  return template
}

/** SQLite本体とWALを複製する。shmは開いた側のSQLiteが作り直す。 */
function copyDatabaseFile(source: string, target: string): void {
  copyFileSync(source, target)
  if (existsSync(`${source}-wal`)) copyFileSync(`${source}-wal`, `${target}-wal`)
}

/** 複製がtemplateと同じschemaを持つことを確かめ、保存形式の変化を黙って見逃さない。 */
async function verifyCopy(name: string, database: D1Database): Promise<void> {
  const expected = (await buildTemplate()).objectCount
  const actual = await countSchemaObjects(database)
  if (actual !== expected) {
    throw new Error(
      `local D1 "${name}" has ${actual} schema objects, expected ${expected} from the migrated template`,
    )
  }
}

async function countSchemaObjects(database: D1Database): Promise<number> {
  const row = await database
    .prepare("SELECT count(*) AS count FROM sqlite_master")
    .first<{ count: number }>()
  return row?.count ?? -1
}

/** Durable Objectの管理用ファイルを除いた、D1本体のSQLiteファイル名。 */
function databaseFiles(directory: string): string[] {
  return readdirSync(directory).filter(
    (file) => file.endsWith(".sqlite") && file !== "metadata.sqlite",
  )
}

/** migrations/ を番号順に、ファイル単位のbatchで適用する。 */
async function applyMigrations(database: D1Database): Promise<void> {
  for (const statements of loadMigrationStatements()) {
    if (statements.length === 0) continue
    await database.batch(statements.map((statement) => database.prepare(statement)))
  }
}

function scratchDirectory(): string {
  if (scratchRoot !== null) return scratchRoot

  const root = mkdtempSync(join(tmpdir(), "local-d1-test-"))
  scratchRoot = root
  process.on("exit", () => rmSync(root, { recursive: true, force: true }))

  return root
}

function loadMigrationStatements(): ReadonlyArray<ReadonlyArray<string>> {
  if (migrationStatements !== null) return migrationStatements

  migrationStatements = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => splitSqlStatements(readFileSync(join(migrationsDirectory, file), "utf8")))

  return migrationStatements
}
