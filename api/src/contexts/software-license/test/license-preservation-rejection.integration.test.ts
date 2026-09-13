import { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"
import { VerifyPreservedRecordContentAdapter } from "@system/infrastructure/adapters/records/verify-preserved-record-content.adapter"
import { drizzle } from "drizzle-orm/d1"
import { expect, test } from "bun:test"
import { z } from "zod"
import { createLicensePreservationFixture } from "@/contexts/software-license/test/create-license-preservation-fixture.test-support"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"

test.each(["reject", "return"] as const)(
  "保全の否定判断は規程に従い再送しても一度だけ記録される: %s",
  async (behavior) => {
    const fixture = await createLicensePreservationFixture(behavior)
    await fixture.f.database.exec(
      "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('license-test-manager','system:record:preserve')",
    )
    const submitted = await fixture.f.request(fixture.path, fixture.command)
    expect(submitted.status).toBe(201)
    const receipt = z
      .object({ number: z.number(), case_id: z.string() })
      .parse(await submitted.json())
    const proposal = await new SystemD1ProposalAdapter({
      env: { DB: fixture.f.database },
    }).findByNumber(receipt.number)
    if (proposal === null || proposal instanceof Error) throw new Error("missing proposal")
    const path = `${fixture.path}/${receipt.number}/reject`
    const body = {
      comment: "Evidence needs correction",
      decision_target: {
        proposal_version: proposal.version,
        proposal_digest: proposal.digest,
        task_key: proposal.currentTaskKey,
        task_round: proposal.currentTaskRound,
      },
    }
    expect((await fixture.f.request(path, { method: "POST", body })).status).toBe(403)
    const rejected = await fixture.f.request(path, {
      method: "POST",
      body,
      accountId: fixture.reviewer.accountId,
    })
    const responseSchema = z.strictObject({ status: z.enum(["rejected", "returned"]) })
    const expected = responseSchema.parse({
      status: behavior === "reject" ? "rejected" : "returned",
    })
    expect({ status: rejected.status, body: await rejected.json() }).toEqual({
      status: 200,
      body: expected,
    })
    const replay = await fixture.f.request(path, {
      method: "POST",
      body,
      accountId: fixture.reviewer.accountId,
    })
    expect(replay.status).toBe(200)
    expect(responseSchema.parse(await replay.json())).toEqual(expected)
    expect((await fixture.f.request(path, { method: "POST", body })).status).toBe(403)
    expect(
      (
        await fixture.f.request(`${fixture.path}/${receipt.number}/execute`, {
          method: "POST",
          body: { proposal_digest: proposal.digest },
        })
      ).status,
    ).toBe(409)
    expect(
      await fixture.f.database
        .prepare("SELECT count(*) AS count FROM system_human_attestations WHERE case_id=?1")
        .bind(receipt.case_id)
        .first<number>("count"),
    ).toBe(1)
    expect(
      await fixture.f.database
        .prepare("SELECT count(*) AS count FROM system_preserved_records")
        .first<number>("count"),
    ).toBe(0)
    const resubmitPath = `${fixture.path}/${receipt.number}/resubmit`
    const corrected = {
      procedure_key: fixture.definition.key,
      conditions: { ...fixture.conditions, reason: "Corrected preservation reason" },
      previous_version: proposal.version,
      previous_digest: proposal.digest,
    }
    expect(
      (
        await fixture.f.request(resubmitPath, {
          method: "POST",
          body: {
            ...corrected,
            previous_digest: "0".repeat(64),
          },
        })
      ).status,
    ).toBe(409)
    expect(fixture.bucket.size()).toBe(1)
    await fixture.f.database
      .prepare("UPDATE software_licenses SET note='Corrected original' WHERE id=?1")
      .bind(fixture.f.license.id)
      .run()
    const simultaneous = await Promise.all([
      fixture.f.request(resubmitPath, { method: "POST", body: corrected }),
      fixture.f.request(resubmitPath, { method: "POST", body: corrected }),
    ])
    expect(simultaneous.map((response) => response.status).sort((a, b) => a - b)).toEqual([
      200, 201,
    ])
    const resubmitted = simultaneous.find((response) => response.status === 201)
    const concurrentReplay = simultaneous.find((response) => response.status === 200)
    if (resubmitted === undefined || concurrentReplay === undefined)
      throw new Error("missing concurrent responses")

    const nextReceiptSchema = z.strictObject({
      number: z.number(),
      case_id: z.string(),
      record_id: z.uuid(),
      status: z.literal("pending"),
    })
    const nextReceipt = nextReceiptSchema.parse(await resubmitted.json())
    expect({ status: resubmitted.status, body: nextReceipt }).toMatchObject({
      status: 201,
      body: { number: receipt.number, status: "pending" },
    })
    const allocatedObjects = fixture.bucket.size()
    expect(allocatedObjects).toBeGreaterThanOrEqual(2)
    expect(nextReceiptSchema.parse(await concurrentReplay.json())).toEqual(nextReceipt)
    const retried = await fixture.f.request(resubmitPath, { method: "POST", body: corrected })
    expect(retried.status).toBe(200)
    expect(nextReceiptSchema.parse(await retried.json())).toEqual(nextReceipt)
    expect(fixture.bucket.size()).toBe(allocatedObjects)
    expect(
      (
        await fixture.f.request(resubmitPath, {
          method: "POST",
          body: {
            ...corrected,
            conditions: { ...corrected.conditions, reason: "Different retry" },
          },
        })
      ).status,
    ).toBe(409)
    const query = new SystemD1ProposalAdapter({ env: { DB: fixture.f.database } })
    expect(await query.findByNumber(receipt.number, 1)).toMatchObject({
      bodyJson: proposal.bodyJson,
      digest: proposal.digest,
      status: expected.status,
    })
    expect(await query.findByNumber(receipt.number)).toMatchObject({
      version: 2,
      seriesId: proposal.seriesId,
      supersedesProposalId: proposal.proposalId,
      status: "pending",
    })
    expect(
      (
        await fixture.f.request(path.replace("/reject", "/approve"), {
          method: "POST",
          body,
          accountId: fixture.reviewer.accountId,
        })
      ).status,
    ).toBe(409)
    const next = await query.findByNumber(receipt.number)
    if (next === null || next instanceof Error) throw new Error("missing resubmission")
    for (const version of [proposal, next]) {
      const intent = await RecordPreservationProposalValue.restore(JSON.parse(version.bodyJson))
      if (intent instanceof Error) throw intent
      const finalization = intent.toFinalization({
        actorAccountId: version.createdByAccountId,
        at: new Date(),
      })
      if (finalization instanceof Error) throw finalization
      const verified = await new VerifyPreservedRecordContentAdapter({
        env: { ...fixture.f.settings.recordStorage },
        var: { database: drizzle(fixture.f.database) },
      }).execute(finalization.record, "pending")
      if (verified instanceof Error) throw verified
      const original = z
        .object({ license: z.object({ note: z.string().nullable() }) })
        .parse(JSON.parse(new TextDecoder().decode(verified.payload.content.toBytes())))
      expect(original.license.note).toBe(version.version === 1 ? null : "Corrected original")
    }

    expect(
      (
        await fixture.f.request(`${fixture.path}/${receipt.number}/approve`, {
          method: "POST",
          accountId: fixture.reviewer.accountId,
          body: {
            comment: null,
            decision_target: {
              proposal_version: next.version,
              proposal_digest: next.digest,
              task_key: next.currentTaskKey,
              task_round: next.currentTaskRound,
            },
          },
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await fixture.f.request(`${fixture.path}/${receipt.number}/execute`, {
          method: "POST",
          body: { proposal_digest: next.digest },
        })
      ).status,
    ).toBe(200)
  },
)
