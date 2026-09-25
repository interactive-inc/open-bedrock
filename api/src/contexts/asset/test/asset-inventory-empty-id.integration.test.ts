import { expect, test } from "bun:test"
import { app } from "@/api/app"
import { createAssetPreservationFixture } from "@/contexts/asset/test/create-asset-preservation-fixture.test-support"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"

test("空の資産コードを初回ページから漏らさず撤去照合を拒否する", async () => {
  const { database, creator, bindings, tokenFor } = await createAssetPreservationFixture()
  await database.exec(`INSERT INTO assets
    (id,code,name,kind,serial,purchased_on,status,holder_employee_id,disposed_on,disposal_reason)
    VALUES ('${crypto.randomUUID()}','','Legacy asset','pc',NULL,NULL,'in_stock',NULL,NULL,NULL)`)
  const token = await tokenFor(creator.accountId)
  const stepUpToken = "c".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(stepUpToken)
  if (hash instanceof Error) throw hash
  const now = Date.now()
  await database
    .prepare(`INSERT INTO system_step_up_grants
    (id,account_id,token_hash,method,issued_at,expires_at)
    VALUES ('asset-inventory-empty-id',?1,?2,'external_identity',?3,?4)`)
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
    "/asset/record-source-freezes",
    { reason: "Audit legacy source" },
    freezeId,
  )
  if (frozen.status !== 201) throw new Error(await frozen.text())
  const coverage = await post(
    `/asset/record-source-freezes/${freezeId}/coverage-pages`,
    { purpose: "archive", recordKind: "asset-record", records: [] },
    crypto.randomUUID(),
  )
  expect(coverage.status).toBe(503)
  expect(
    await database
      .prepare("SELECT count(*) AS n FROM system_record_coverage_pages")
      .first<number>("n"),
  ).toBe(0)
})

test("空の棚卸しIDを初回ページから漏らさず撤去照合を拒否する", async () => {
  const { database, creator, bindings, tokenFor } = await createAssetPreservationFixture()
  await database.exec(`INSERT INTO stocktake_items
    (id,stocktake_id,asset_code,checked_at,checker_employee_id,location_note)
    VALUES ('${crypto.randomUUID()}','','A-1',NULL,NULL,NULL)`)
  const token = await tokenFor(creator.accountId)
  const stepUpToken = "c".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(stepUpToken)
  if (hash instanceof Error) throw hash
  const now = Date.now()
  await database
    .prepare(`INSERT INTO system_step_up_grants
    (id,account_id,token_hash,method,issued_at,expires_at)
    VALUES ('asset-inventory-empty-composite-id',?1,?2,'external_identity',?3,?4)`)
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
    "/asset/record-source-freezes",
    { reason: "Audit legacy source" },
    freezeId,
  )
  if (frozen.status !== 201) throw new Error(await frozen.text())
  const coverage = await post(
    `/asset/record-source-freezes/${freezeId}/coverage-pages`,
    { purpose: "archive", recordKind: "stocktake-item-record", records: [] },
    crypto.randomUUID(),
  )
  expect(coverage.status).toBe(503)
  expect(
    await database
      .prepare("SELECT count(*) AS n FROM system_record_coverage_pages")
      .first<number>("n"),
  ).toBe(0)
})
