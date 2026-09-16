import { expect, test } from "bun:test"
import { app } from "@/api/app"
import { createAnnouncementPreservationFixture } from "@/contexts/announcement/test/create-announcement-preservation-fixture.test-support"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"

test("ID 0 の原記録を初回ページから漏らさず撤去照合を拒否する", async () => {
  const { database, creator, bindings, tokenFor } = await createAnnouncementPreservationFixture()
  await database
    .prepare(`INSERT INTO announcements
    (id,title,body_md,published_on,author_employee_id,status,created_at)
    VALUES (0,'Legacy','Original','2026-09-01',?1,'published','2026-09-01T00:00:00Z')`)
    .bind(creator.employeeId)
    .run()
  const token = await tokenFor(creator.accountId)
  const stepUpToken = "d".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(stepUpToken)
  if (hash instanceof Error) throw hash
  const now = Date.now()
  await database
    .prepare(`INSERT INTO system_step_up_grants
    (id,account_id,token_hash,method,issued_at,expires_at)
    VALUES ('inventory-invalid-id',?1,?2,'external_identity',?3,?4)`)
    .bind(creator.accountId, hash, now, now + 60_000)
    .run()
  const post = (path: string, body: unknown, key: string) =>
    app.request(
      path,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "idempotency-key": key,
          "x-system-step-up": stepUpToken,
        },
        body: JSON.stringify(body),
      },
      bindings,
    )
  const freezeId = crypto.randomUUID()
  const frozen = await post(
    "/announcement/record-source-freezes",
    {
      reason: "Audit legacy source",
    },
    freezeId,
  )
  if (frozen.status !== 201) throw new Error(await frozen.text())
  const coverage = await post(
    `/announcement/record-source-freezes/${freezeId}/coverage-pages`,
    { purpose: "archive", records: [] },
    crypto.randomUUID(),
  )
  expect(coverage.status).toBe(409)
  expect(
    await database
      .prepare("SELECT count(*) AS n FROM system_record_coverage_pages")
      .first<number>("n"),
  ).toBe(0)
})
