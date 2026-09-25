import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { createAnnouncementPreservationFixture } from "@/contexts/announcement/test/create-announcement-preservation-fixture.test-support"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(1)
})

afterAll(async () => {
  await pool.dispose()
})

// 撤去照合の目録は UUID の主キーだけを扱う。UUID でない主キーの原記録は DB が保存させないため、
// 目録から漏れる記録は生じない。
test("UUID でない主キーの原記録は保存できず、撤去照合の目録から漏れる記録を作れない", async () => {
  const { database, creator } = await createAnnouncementPreservationFixture(await pool.next())
  for (const id of ["0", "legacy-announcement", "00000000-0000-0000-0000-000000000000"]) {
    await expect(
      database
        .prepare(`INSERT INTO announcements
        (id,title,body_md,published_on,author_employee_id,status,created_at)
        VALUES (?1,'Legacy','Original','2026-09-01',?2,'published','2026-09-01T00:00:00Z')`)
        .bind(id, creator.employeeId)
        .run(),
    ).rejects.toThrow("CHECK constraint failed")
  }
  expect(await database.prepare("SELECT count(*) AS n FROM announcements").first<number>("n")).toBe(
    0,
  )
})
