import { expect, test } from "bun:test"
import { z } from "zod"
import { app } from "@/api/app"
import { createPerformanceReviewPreservationFixture } from "@/contexts/performance-review/test/create-performance-review-preservation-fixture.test-support"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { GET as preservedDossier } from "@system/interface/routes/system.preserved-records.$recordId.dossier"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { drizzle } from "drizzle-orm/d1"

test("評価テンプレートを停止中に人の承認で保全し、業務コードを外してもSystemから読める", async () => {
  const { database, creator, reviewer, definition, bindings, tokenFor, request } =
    await createPerformanceReviewPreservationFixture()
  await database
    .prepare(`INSERT INTO evaluation_templates
    (id,title,period,items,status,created_by,created_at,updated_at)
    VALUES (0,'Quarterly review','2026-Q3','[]','draft',?1,'2026-09-01','2026-09-01')`)
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
      VALUES ('performance-review-test-step-up',?1,?2,'external_identity',?3,?4)`)
    .bind(creator.accountId, hash, now.getTime(), now.getTime() + 60_000)
    .run()
  const frozen = await app.request(
    "/performance-review/record-source-freezes",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
        "x-system-step-up": stepUpToken,
      },
      body: JSON.stringify({ reason: "Retain performance-review evidence" }),
    },
    bindings,
  )
  if (frozen.status !== 201) throw new Error(await frozen.text())
  await expect(
    database.prepare("UPDATE evaluation_templates SET title='changed' WHERE id=0").run(),
  ).rejects.toThrow("performance_review_record_source_frozen")
  const sources = [["evaluation-template-record", "0"]] as const
  const preservedIds: string[] = []
  for (const [recordKind, recordId] of sources) {
    const path = `/performance-review/records/${recordKind}/${recordId}/preservation-requests`
    const submitted = await request(path, {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: {
        procedure_key: definition.key,
        conditions: {
          reason: "Retain original performance-review record",
          preservation: { kind: "hold", retainUntil: null, reason: "Company evidence" },
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
    const proposal = await new SystemD1ProposalAdapter({ env: { DB: database } }).findByNumber(
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
    preservedIds.push(record.record_id)
  }
  await database.exec(`INSERT INTO system_iam_role_permissions(role_id,permission_key)
    VALUES ('performance-review-test-manager','system:record:export');
    DROP TABLE evaluation_sheet_audit_logs;
    DROP TABLE evaluation_sheets;
    DROP TABLE evaluation_templates;
    DROP TABLE goal_evaluations;
    DROP TABLE performance_goals;
    DROP TABLE review_cycle_policies;
    DROP TABLE review_cycles;
    DROP TABLE review_forms;`)
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
    expect(body.source).toMatchObject({
      ownerContext: "performance-review",
      recordKind: sources[index]?.[0],
    })
    const content = JSON.parse(Buffer.from(body.contentBase64, "base64").toString("utf8"))
    expect(content.format).toBe(sources[index]?.[0])
  }
})
