import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { createLicenseFixture } from "@/contexts/software-license/test/create-license-fixture.test-support"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(4)
})

afterAll(async () => {
  await pool.dispose()
})

test("registration requires a caller-owned retry key without recording a contract", async () => {
  const fixture = await createLicenseFixture(await pool.next())
  const before = await fixture.database.prepare("SELECT * FROM software_licenses").all()
  const response = await fixture.request("/software-licenses", {
    method: "POST",
    body: { name: "Unconfirmed registration" },
  })

  expect(response.status).toBe(400)
  expect(await fixture.database.prepare("SELECT * FROM software_licenses").all()).toEqual(before)
})

test.each(["update", "cancel"])(
  "%s requires the revision the caller reviewed",
  async (operation) => {
    const fixture = await createLicenseFixture(await pool.next())
    const before = await fixture.database.prepare("SELECT * FROM software_licenses").all()
    const path = `/software-licenses/${fixture.license.id}`
    const response = await fixture.request(operation === "cancel" ? `${path}/cancel` : path, {
      method: operation === "cancel" ? "POST" : "PUT",
      body: operation === "cancel" ? undefined : { name: "Unreviewed update" },
    })

    expect(response.status).toBe(400)
    expect(await fixture.database.prepare("SELECT * FROM software_licenses").all()).toEqual(before)
  },
)

test("a reviewed contract cannot be cancelled after another person changes it", async () => {
  const fixture = await createLicenseFixture(await pool.next())
  const path = `/software-licenses/${fixture.license.id}`
  const headers = { "if-match": String(fixture.license.revision) }
  const updated = await fixture.request(path, {
    method: "PUT",
    headers,
    body: { name: "Reviewed replacement", seats: 2 },
  })
  expect(updated.status).toBe(200)
  const before = await fixture.database.prepare("SELECT * FROM software_licenses").all()

  const cancelled = await fixture.request(`${path}/cancel`, { method: "POST", headers })
  expect(cancelled.status).toBe(409)
  expect(await fixture.database.prepare("SELECT * FROM software_licenses").all()).toEqual(before)
})
