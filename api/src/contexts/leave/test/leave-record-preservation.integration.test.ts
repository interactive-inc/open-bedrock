import { expect, test } from "bun:test"
import { z } from "zod"
import { app } from "@/api/app"
import { createLeavePreservationFixture } from "@/contexts/leave/test/create-leave-preservation-fixture.test-support"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"
import { encodeLeaveBalanceRecordId } from "@/contexts/leave/domain/definitions/leave-record-kind.definition"
import { GET as preservedDossier } from "@system/interface/routes/system.preserved-records.$recordId.dossier"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { drizzle } from "drizzle-orm/d1"

test("休暇の停止中に申請と残数の原文を人の承認後にSystemへ保全する", async () => {
  const fixture = await createLeavePreservationFixture()
  const { database, creator, reviewer, definition, bindings, tokenFor, request } = fixture
  await database
    .prepare(`INSERT INTO leave_requests
      (id,employee_id,leave_type,start_date,end_date,days,reason,status,approver_id,
       decided_comment,created_at,unit,hours,consumed_days)
      VALUES ('01900049-0000-7000-8000-000000000001',?1,'annual','2026-10-01','2026-10-02',2,'family','pending',NULL,NULL,
       '2026-09-01T00:00:00.000Z','full_day',NULL,2)`)
    .bind(creator.employeeId)
    .run()
  await database
    .prepare(`INSERT INTO leave_balances
      (id,employee_id,fiscal_year,leave_type,granted_days,used_days,remaining_days)
      VALUES ('0190004c-0000-7000-8000-000000000001',?1,'2026','annual',20,2,18)`)
    .bind(creator.employeeId)
    .run()
  const token = await tokenFor(creator.accountId)
  const stepUpToken = "e".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(stepUpToken)
  if (hash instanceof Error) throw hash
  const now = new Date()
  await database
    .prepare(`INSERT INTO system_step_up_grants
      (id,account_id,token_hash,method,issued_at,expires_at)
      VALUES ('leave-test-step-up',?1,?2,'external_identity',?3,?4)`)
    .bind(creator.accountId, hash, now.getTime(), now.getTime() + 60_000)
    .run()
  const freeze = await app.request(
    "/leave/record-source-freezes",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
        "x-system-step-up": stepUpToken,
      },
      body: JSON.stringify({ reason: "Retain leave evidence" }),
    },
    bindings,
  )
  if (freeze.status !== 201) throw new Error(await freeze.text())
  await expect(
    database
      .prepare(
        "UPDATE leave_requests SET reason='changed' WHERE id='01900049-0000-7000-8000-000000000001'",
      )
      .run(),
  ).rejects.toThrow("leave_record_source_frozen")
  await expect(
    database
      .prepare("UPDATE leave_balances SET remaining_days=17 WHERE employee_id=?1")
      .bind(creator.employeeId)
      .run(),
  ).rejects.toThrow("leave_record_source_frozen")
  const sources = [
    ["leave-request-record", "01900049-0000-7000-8000-000000000001"],
    ["leave-balance-record", encodeLeaveBalanceRecordId(creator.employeeId, "2026", "annual")],
  ] as const
  const preservedIds: string[] = []
  for (const [recordKind, recordId] of sources) {
    const path = `/leave/records/${recordKind}/${encodeURIComponent(recordId)}/preservation-requests`
    const submitted = await request(path, {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: {
        procedure_key: definition.key,
        conditions: {
          reason: "Retain original leave record",
          preservation: { kind: "hold", retainUntil: null, reason: "Company record" },
          disclosure: {
            reason: "Restricted archive",
            grants: [
              {
                accountId: creator.accountId,
                actions: ["read", "export"],
                purposes: ["archive"],
                validFrom: now.toISOString(),
                validUntil: null,
              },
            ],
          },
        },
      },
    })
    if (submitted.status !== 201) throw new Error(await submitted.text())
    const record = z
      .object({ number: z.number(), record_id: z.string() })
      .parse(await submitted.json())
    const proposal = await openSystemProposals({ env: { DB: database } }).findByNumber(
      record.number,
    )
    if (proposal === null || proposal instanceof Error) throw new Error("missing proposal")
    const approved = await request(`${path}/${record.number}/approve`, {
      method: "POST",
      accountId: reviewer.accountId,
      body: {
        decision_target: {
          proposal_version: proposal.version,
          proposal_digest: proposal.digest,
          task_key: proposal.currentTaskKey,
          task_round: proposal.currentTaskRound,
        },
        comment: "Reviewed source",
      },
    })
    if (approved.status !== 200) throw new Error(await approved.text())
    const executed = await request(`${path}/${record.number}/execute`, {
      method: "POST",
      body: { proposal_digest: proposal.digest },
    })
    if (executed.status !== 200) throw new Error(await executed.text())
    expect(record.record_id).not.toBe("")
    preservedIds.push(record.record_id)
  }
  await database.exec(`INSERT INTO system_iam_role_permissions(role_id,permission_key)
    VALUES ('leave-test-manager','system:record:export');
    DROP TABLE leave_decision_notifications;
    DROP TABLE leave_procedure_bindings;
    DROP TABLE leave_balances;
    DROP TABLE leave_requests;`)
  const core = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => new Date())
      context.set("database", drizzle(database))
      await next()
    })
    .get("/system/preserved-records/:recordId/dossier", ...preservedDossier)
  for (const [index, recordId] of preservedIds.entries()) {
    const dossier = await core.request(
      `/system/preserved-records/${recordId}/dossier?purpose=archive`,
      { headers: { authorization: `Bearer ${token}` } },
      bindings,
    )
    if (dossier.status !== 200) throw new Error(await dossier.text())
    const body = z
      .object({
        source: z.object({ ownerContext: z.string(), recordKind: z.string() }),
        contentBase64: z.string(),
        execution: z.object({ caseId: z.string() }),
        auditReceipts: z.array(z.unknown()),
      })
      .parse(await dossier.json())
    expect(body.source).toMatchObject({ ownerContext: "leave", recordKind: sources[index]?.[0] })
    const content = JSON.parse(Buffer.from(body.contentBase64, "base64").toString("utf8"))
    expect(content.format).toBe(sources[index]?.[0])
    expect(content[index === 0 ? "request" : "balance"]).toBeDefined()
  }
})
