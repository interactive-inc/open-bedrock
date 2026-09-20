import { ListUndeliveredLifecycleActionsAdapter } from "@/contexts/onboarding/infrastructure/adapters/list-undelivered-lifecycle-actions.adapter"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"

const window = { recordedFrom: 0, recordedUntil: 1000, observedOn: "2026-09-10" }

function createDatabase(total: number, deliveredCount: number): D1Database {
  const sqlite = new Database(":memory:")
  sqlite.run(`CREATE TABLE company_personnel_actions (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, event_on TEXT NOT NULL,
    recorded_at INTEGER NOT NULL, payload_fingerprint TEXT NOT NULL, summary_json TEXT NOT NULL)`)
  sqlite.run("CREATE TABLE onboarding_lifecycle_deliveries (action_id TEXT PRIMARY KEY)")
  const action = sqlite.prepare(
    "INSERT INTO company_personnel_actions VALUES (?1, 'hire', '2026-09-01', 100, ?2, '{}')",
  )
  const delivery = sqlite.prepare("INSERT INTO onboarding_lifecycle_deliveries VALUES (?1)")
  for (let index = 1; index <= total; index += 1) {
    const id = `action-${String(index).padStart(4, "0")}`
    action.run(id, `fingerprint:${id}`)
    if (index <= deliveredCount) delivery.run(id)
  }
  return createCompanyD1TestDatabase(sqlite)
}

test("受領済みの発令が複数ページ続いても、その先の未受領を記録順に上限まで集める", async () => {
  const actions = await new ListUndeliveredLifecycleActionsAdapter(createDatabase(260, 230)).list({
    ...window,
    limit: 20,
  })
  if (actions instanceof Error) throw actions

  expect(actions).toHaveLength(20)
  expect(actions[0]?.actionId).toBe("action-0231")
  expect(actions.at(-1)?.actionId).toBe("action-0250")
})

test("未受領が上限より少なければ最後のページまで読んで終わる", async () => {
  const actions = await new ListUndeliveredLifecycleActionsAdapter(createDatabase(205, 200)).list({
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
  const actions = await new ListUndeliveredLifecycleActionsAdapter(createDatabase(200, 200)).list({
    ...window,
    limit: 50,
  })

  expect(actions).toEqual([])
})
