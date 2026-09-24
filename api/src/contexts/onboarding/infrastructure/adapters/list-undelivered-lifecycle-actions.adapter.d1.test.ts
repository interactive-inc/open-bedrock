import { ListUndeliveredLifecycleActionsAdapter } from "@/contexts/onboarding/infrastructure/adapters/list-undelivered-lifecycle-actions.adapter"
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

const window = { recordedFrom: 0, recordedUntil: 1000, observedOn: "2026-09-10" }

let local: LocalD1

// ローカルD1のworkerd起動を含むため、既定の5秒では足りないことがある。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({ empty: ["delivered-pages", "short-tail", "exact-pages"] })
})

afterAll(async () => {
  await local.dispose()
})

/** 受領判定に使う2表だけを空のローカルD1へ作り、記録順の発令と受領を投入する。 */
async function createDatabase(
  name: string,
  total: number,
  deliveredCount: number,
): Promise<D1Database> {
  const database = await local.database(name)
  const statements = [
    database.prepare(`CREATE TABLE company_personnel_actions (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, event_on TEXT NOT NULL,
    recorded_at INTEGER NOT NULL, payload_fingerprint TEXT NOT NULL, summary_json TEXT NOT NULL)`),
    database.prepare("CREATE TABLE onboarding_lifecycle_deliveries (action_id TEXT PRIMARY KEY)"),
  ]
  for (let index = 1; index <= total; index += 1) {
    const id = `action-${String(index).padStart(4, "0")}`
    statements.push(
      database
        .prepare(
          "INSERT INTO company_personnel_actions VALUES (?1, 'hire', '2026-09-01', 100, ?2, '{}')",
        )
        .bind(id, `fingerprint:${id}`),
    )
    if (index <= deliveredCount)
      statements.push(
        database.prepare("INSERT INTO onboarding_lifecycle_deliveries VALUES (?1)").bind(id),
      )
  }
  await database.batch(statements)
  return database
}

test("受領済みの発令が複数ページ続いても、その先の未受領を記録順に上限まで集める", async () => {
  const actions = await new ListUndeliveredLifecycleActionsAdapter(
    await createDatabase("delivered-pages", 260, 230),
  ).list({
    ...window,
    limit: 20,
  })
  if (actions instanceof Error) throw actions

  expect(actions).toHaveLength(20)
  expect(actions[0]?.actionId).toBe("action-0231")
  expect(actions.at(-1)?.actionId).toBe("action-0250")
})

test("未受領が上限より少なければ最後のページまで読んで終わる", async () => {
  const actions = await new ListUndeliveredLifecycleActionsAdapter(
    await createDatabase("short-tail", 205, 200),
  ).list({
    ...window,
    limit: 50,
  })
  if (actions instanceof Error) throw actions

  expect(actions.map((action) => action.actionId)).toEqual([
    "action-0201",
    "action-0202",
    "action-0203",
    "action-0204",
    "action-0205",
  ])
})

test("発令がちょうどページの倍数でも終了する", async () => {
  const actions = await new ListUndeliveredLifecycleActionsAdapter(
    await createDatabase("exact-pages", 200, 200),
  ).list({
    ...window,
    limit: 50,
  })

  expect(actions).toEqual([])
})
