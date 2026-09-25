import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { execSql } from "@tests/d1/support/exec-sql"

const migrationsDirectory = join(import.meta.dir, "../../../migrations")
const seedsDirectory = join(import.meta.dir, "../../../seeds")

/** seed を当てる順序。verify-seed と同じく、社員と組織を先に入れて外部キーを満たす。 */
const SEED_ORDER = [
  "employee",
  "org",
  "iam",
  "employee-lifecycle",
  "application",
  "approval-delegation",
  "personnel-action",
  "position",
  "grade",
  "company-public-workforce",
]

/**
 * 整数の主キーから UUID へ移した table の seed の ID。seed の UUID は
 * `<prefix>-0000-7000-8000-<連番の16進>` の形で、prefix が table を、末尾が移行前の整数の主キーを表す。
 * 移行前の schema に seed を入れるときは、主キーがまだ整数の table の ID を連番へ戻す。
 */
const LEGACY_INTEGER_SEED_PREFIXES: Readonly<Record<string, string>> = {
  "0190000a": "commendations",
  "0190000b": "disciplinary_actions",
  "0190000c": "work_accidents",
  "0190000d": "health_checkups",
  "0190000e": "it_incidents",
  "0190000f": "headcount_plans",
  "01900010": "employee_work_styles",
  "01900011": "company_calendar_days",
  "01900012": "document_ledger_entries",
  "01900014": "announcements",
  "01900015": "asset_lendings",
  "01900016": "attendance_records",
  "01900017": "career_postings",
  "01900018": "career_applications",
  "01900019": "certification_definitions",
  "0190001a": "decision_records",
  "0190001b": "meetings",
  "0190001c": "meeting_minutes_records",
  "0190001d": "partners",
  "0190001e": "partner_contracts",
  "0190001f": "regulations",
  "01900020": "regulation_versions",
  "01900021": "employee_certifications",
  "01900022": "rooms",
  "01900023": "shift_patterns",
  "01900024": "shift_assignments",
  "01900025": "shift_swap_requests",
  "01900026": "surveys",
  "01900027": "survey_responses",
  "01900028": "thanks_messages",
  "01900029": "thanks_point_budgets",
  "0190002a": "thanks_rewards",
  "0190002b": "thanks_redemptions",
  "0190002c": "training_courses",
  "0190002d": "training_enrollments",
  "0190002e": "job_openings",
  "0190002f": "recruitment_candidates",
  "01900030": "performance_goals",
  "01900031": "goal_evaluations",
  "01900032": "review_cycles",
  "01900033": "review_forms",
}

/**
 * 空のローカルD1へ、対象より前の migration を1ファイルずつ当てる。
 * wrangler と同じく1ファイルを1つの batch として送り、ファイルの途中で止まれば全体を戻す。
 */
export async function migrateLocalD1Before(database: D1Database, target: string): Promise<void> {
  const files = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql") && file < target)
    .sort()
  for (const file of files) await applyLocalD1Migration(database, file)
}

export async function applyLocalD1Migration(database: D1Database, file: string): Promise<void> {
  await execSql(database, readFileSync(join(migrationsDirectory, file), "utf8"))
}

async function integerKeyedPrefixes(database: D1Database): Promise<ReadonlySet<string>> {
  const prefixes = new Set<string>()
  for (const [prefix, table] of Object.entries(LEGACY_INTEGER_SEED_PREFIXES)) {
    const column = await database
      .prepare(`SELECT type FROM pragma_table_info('${table}') WHERE name = 'id'`)
      .first<{ type: string }>()
    if (column?.type.toUpperCase() === "INTEGER") prefixes.add(prefix)
  }
  return prefixes
}

/**
 * 開発用 seed を入れる。本番に近い行数と参照関係の上で migration を確かめるために使う。
 * seed は最新の schema に合わせて書いてあるため、主キーがまだ整数の table の ID は連番へ戻して入れる。
 */
export async function seedLocalD1(database: D1Database): Promise<void> {
  const legacy = await integerKeyedPrefixes(database)
  const files = readdirSync(seedsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort()
  const ordered = [
    ...SEED_ORDER.map((name) => `${name}.sql`),
    ...files.filter((file) => !SEED_ORDER.includes(file.replace(".sql", ""))),
  ]
  for (const file of ordered) {
    const sql = readFileSync(join(seedsDirectory, file), "utf8").replaceAll(
      /'([0-9a-f]{8})-0000-7000-8000-([0-9a-f]{12})'/gu,
      (literal, prefix: string, serial: string) =>
        legacy.has(prefix) ? String(Number.parseInt(serial, 16)) : literal,
    )
    if (sql.includes("INSERT INTO")) await execSql(database, sql)
  }
}
