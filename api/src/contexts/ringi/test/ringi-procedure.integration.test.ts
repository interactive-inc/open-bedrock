import { describe, expect, spyOn, test } from "bun:test"
import { createRingiProcedureTestContext } from "@/contexts/ringi/test/ringi-procedure.test-support"
import { RingiRequestRepository } from "@/contexts/ringi/infrastructure/repositories/ringi-request.repository"
import { SubmitRingiProcedure } from "@/contexts/ringi/application/submit-ringi-procedure"
import { ApproveSystemTask } from "@system/application/workflow/approve-system-task"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { systemCaseIdSchema } from "@system/domain/schemas/workflow/system-case.schema"
import { proposalDigestSchema } from "@system/domain/schemas/workflow/system-case-reference.schema"
import { ForbiddenError, ConflictError, ValidationError } from "@/lib/errors"

async function pending() {
  const c = await createRingiProcedureTestContext()
  const created = await c.repository.createWithProcedure(c.submission)
  if (created instanceof Error || created.id === null) throw created
  return { ...c, id: created.id }
}

async function approved() {
  const c = await pending()
  expect((await c.approve(c.first)).caseStatus).toBe("pending")
  expect((await c.approve(c.second)).caseStatus).toBe("approved")
  return c
}

describe("稟議と共通の承認・実行基盤", () => {
  test("提出・再送・競合で業務稟議と承認案件を一組だけ保存する", async () => {
    const c = await createRingiProcedureTestContext()
    const application = new SubmitRingiProcedure(c.context)
    const command = {
      requestKey: crypto.randomUUID(),
      session: {
        accountId: c.requester.accountId,
        employeeId: c.requester.employeeId,
        hasPermission: (key: string) => key === "ringi:submit",
      },
      tokenVersion: 0,
      approverId: c.first.employeeId,
      title: "Equipment purchase",
      amount: 500,
      reason: "Replace equipment",
      createdAt: c.at,
    }
    const created = await Promise.all([application.run(command), application.run(command)])
    expect(created.every((entry) => !(entry instanceof Error))).toBe(true)
    const original = created[0]
    if (original === undefined || original instanceof Error) throw original
    expect(created.filter((entry) => !(entry instanceof Error) && !entry.replayed)).toHaveLength(1)
    expect(await application.run(command)).toMatchObject({
      request: { id: original.request.id },
      replayed: true,
    })
    expect(await application.run({ ...command, amount: 600 })).toBeInstanceOf(ConflictError)
    for (const table of [
      "ringi_requests",
      "ringi_procedure_bindings",
      "system_proposals",
      "system_cases",
    ])
      expect(
        await c.database.prepare(`SELECT count(*) AS total FROM ${table}`).first<number>("total"),
      ).toBe(1)
    if (original.request.id === null) throw new Error("saved request ID is missing")
    const binding = await c.repository.findProcedure(original.request.id)
    if (binding instanceof Error || binding === null) throw binding
    for (const person of [c.first, c.second]) {
      expect(
        await new ApproveSystemTask(new SystemD1WorkflowAdapter(c.context)).execute({
          caseId: systemCaseIdSchema.parse(binding.caseId),
          taskKey: c.step.key,
          round: 1,
          actorAccountId: person.accountId,
          representedAccountId: person.accountId,
          delegationId: null,
          proposalDigest: proposalDigestSchema.parse(binding.proposalDigest),
          comment: "Reviewed submission",
          decidedAt: c.at,
          nextTask: null,
        }),
      ).not.toBeInstanceOf(Error)
    }
    expect(await c.complete.run(c.command(original.request.id))).toEqual({
      status: "approved",
      replayed: false,
    })
    expect(await application.run(command)).toMatchObject({
      request: { status: "approved" },
      replayed: true,
    })
    await c.database.exec(
      "DELETE FROM system_iam_role_permissions WHERE role_id = 'ringi-test-role'",
    )
    expect(await application.run(command)).toBeInstanceOf(ForbiddenError)
  })

  test("未設定の規程、金額範囲外と本人指定を別の資格で補わない", async () => {
    const c = await createRingiProcedureTestContext()
    const application = new SubmitRingiProcedure(c.context)
    const command = {
      requestKey: crypto.randomUUID(),
      session: {
        accountId: c.requester.accountId,
        employeeId: c.requester.employeeId,
        hasPermission: () => true,
      },
      tokenVersion: 0,
      approverId: c.first.employeeId,
      title: "Equipment purchase",
      amount: 2000,
      reason: "Replace equipment",
      createdAt: c.at,
    }
    expect(await application.run(command)).toBeInstanceOf(ValidationError)
    expect(
      await application.run({ ...command, amount: 500, approverId: c.requester.employeeId }),
    ).toBeInstanceOf(ValidationError)
    await c.database.exec(
      "UPDATE system_procedure_definitions SET status = 'retired' WHERE key = 'ringi_request'",
    )
    expect(await application.run({ ...command, amount: 500 })).toBeInstanceOf(ValidationError)
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM ringi_requests")
        .first<number>("total"),
    ).toBe(0)
  })

  test("同じ実行の競合は一回の確定へ収束し、権限失効後の再送を拒否する", async () => {
    const c = await approved()
    const completed = await Promise.all([
      c.complete.run(c.command(c.id)),
      c.complete.run(c.command(c.id)),
    ])
    expect(
      completed.every((entry) => !(entry instanceof Error) && entry.status === "approved"),
    ).toBe(true)
    expect(completed.filter((entry) => !(entry instanceof Error) && !entry.replayed)).toHaveLength(
      1,
    )
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM system_execution_authorizations")
        .first<number>("total"),
    ).toBe(1)
    await c.database.exec(
      "DELETE FROM system_iam_role_permissions WHERE role_id = 'ringi-test-role'",
    )
    expect(await c.complete.run(c.command(c.id))).toBeInstanceOf(ForbiddenError)
    expect(await c.repository.findById(c.id)).toMatchObject({ status: "approved" })
  })

  test("提案と違う業務内容や対象の対応を残さない", async () => {
    const c = await createRingiProcedureTestContext()
    expect(
      await c.repository.createWithProcedure({ ...c.submission, requestKey: "another-request" }),
    ).toBeInstanceOf(Error)
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM ringi_requests")
        .first<number>("total"),
    ).toBe(0)
    expect(await c.repository.createWithProcedure(c.submission)).not.toBeInstanceOf(Error)
  })

  test("必要人数の承認後にだけ業務稟議を確定し、再送で実行と監査を増やさない", async () => {
    const c = await pending()
    expect(await c.complete.run(c.command(c.id))).toBeInstanceOf(ForbiddenError)
    await c.approve(c.first)
    expect(await c.complete.run(c.command(c.id))).toBeInstanceOf(ForbiddenError)
    await c.approve(c.second)
    expect(await c.complete.run(c.command(c.id))).toEqual({ status: "approved", replayed: false })
    expect(await c.complete.run(c.command(c.id))).toEqual({ status: "approved", replayed: true })
    expect(await c.repository.findById(c.id)).toMatchObject({
      status: "approved",
      title: "Equipment purchase",
      amount: 500,
    })
    expect(
      await c.database
        .prepare(
          "SELECT count(*) AS total FROM system_execution_authorizations WHERE used_at IS NOT NULL",
        )
        .first<number>("total"),
    ).toBe(1)
    expect(
      await c.database
        .prepare(
          "SELECT count(*) AS total FROM system_audit_events WHERE action = 'ringi.request.authorized'",
        )
        .first<number>("total"),
    ).toBe(1)
  })

  test("業務だけの決裁と提案内容の差替えをDBで拒否する", async () => {
    const c = await pending()
    for (const sql of [
      "UPDATE ringi_requests SET amount = 900 WHERE id = ?1",
      "UPDATE ringi_requests SET status = 'approved' WHERE id = ?1",
    ])
      expect(
        await c.database
          .prepare(sql)
          .bind(c.id)
          .run()
          .then(
            () => null,
            (cause: unknown) => cause,
          ),
      ).toBeInstanceOf(Error)
    expect(await c.repository.findById(c.id)).toMatchObject({ status: "pending", amount: 500 })
  })

  test.each(["ringi", "binding", "audit"])(
    "申請保存の途中失敗で案件・業務・監査をすべて取り消す: %s",
    async (failure) => {
      const c = await createRingiProcedureTestContext()
      const table =
        failure === "ringi"
          ? "ringi_requests"
          : failure === "binding"
            ? "ringi_procedure_bindings"
            : "system_audit_events"
      await c.database.exec(
        `CREATE TRIGGER reject_ringi_creation BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'creation failed'); END;`,
      )
      expect(await c.repository.createWithProcedure(c.submission)).toBeInstanceOf(Error)
      for (const name of [
        "ringi_requests",
        "ringi_procedure_bindings",
        "system_cases",
        "system_proposals",
      ])
        expect(
          await c.database.prepare(`SELECT count(*) AS total FROM ${name}`).first<number>("total"),
        ).toBe(0)
      await c.database.exec("DROP TRIGGER reject_ringi_creation")
      expect(await c.repository.createWithProcedure(c.submission)).not.toBeInstanceOf(Error)
    },
  )

  test.each(["authority", "permission", "principal"])(
    "承認後に失った資格では実行しない: %s",
    async (change) => {
      const c = await approved()
      if (change === "permission")
        await c.database.exec(
          "DELETE FROM system_iam_role_permissions WHERE role_id = 'ringi-test-role'",
        )
      else if (change === "principal")
        await c.database
          .prepare("DELETE FROM system_principals WHERE account_id = ?1")
          .bind(c.second.accountId)
          .run()
      else {
        const membership = c.resources.find(
          (resource) =>
            resource.type === "collective-body-membership" &&
            resource.attributes.employeeId === c.first.employeeId,
        )
        if (membership === undefined) throw new Error("membership missing")
        await c.write([
          { ...membership, revision: 2, attributes: { ...membership.attributes, voting: false } },
        ])
      }
      expect(await c.complete.run(c.command(c.id))).toBeInstanceOf(ForbiddenError)
      expect(await c.repository.findById(c.id)).toMatchObject({ status: "pending" })
      expect(
        await c.database
          .prepare("SELECT count(*) AS total FROM system_execution_authorizations")
          .first<number>("total"),
      ).toBe(0)
    },
  )

  test.each(["permission", "authority", "audit", "target"])(
    "準備後の資格変更と保存失敗で業務・実行許可・監査を取り消す: %s",
    async (change) => {
      const c = await approved()
      const interception = spyOn(
        RingiRequestRepository.prototype,
        "executeAuthorized",
      ).mockImplementationOnce(async function (this: RingiRequestRepository, input) {
        interception.mockRestore()
        if (change === "target") {
          const unrelated = await c.repository.create(c.submission.ringi)
          if (unrelated instanceof Error || unrelated.id === null) throw unrelated
          return this.executeAuthorized({
            ...input,
            binding: { ...input.binding, ringiId: unrelated.id },
          })
        }
        if (change === "permission")
          await c.database.exec(
            "DELETE FROM system_iam_role_permissions WHERE role_id = 'ringi-test-role'",
          )
        else if (change === "audit")
          await c.database.exec(
            "CREATE TRIGGER reject_ringi_execution_audit BEFORE INSERT ON system_audit_events WHEN NEW.action = 'ringi.request.authorized' BEGIN SELECT RAISE(ABORT, 'audit failed'); END;",
          )
        else {
          const membership = c.resources.find(
            (resource) =>
              resource.type === "collective-body-membership" &&
              resource.attributes.employeeId === c.first.employeeId,
          )
          if (membership === undefined) throw new Error("membership missing")
          await c.write([
            { ...membership, revision: 2, attributes: { ...membership.attributes, voting: false } },
          ])
        }
        return this.executeAuthorized(input)
      })
      try {
        expect(await c.complete.run(c.command(c.id))).toBeInstanceOf(ConflictError)
      } finally {
        interception.mockRestore()
      }
      expect(await c.repository.findById(c.id)).toMatchObject({ status: "pending" })
      expect(
        await c.database
          .prepare("SELECT count(*) AS total FROM system_execution_authorizations")
          .first<number>("total"),
      ).toBe(0)
      expect(
        await c.database
          .prepare("SELECT status FROM system_cases WHERE id = ?1")
          .bind(c.submission.workflow.workflowCase.id)
          .first<string>("status"),
      ).toBe("approved")
      if (change === "audit") {
        await c.database.exec("DROP TRIGGER reject_ringi_execution_audit")
        expect(await c.complete.run(c.command(c.id))).toEqual({
          status: "approved",
          replayed: false,
        })
      }
    },
  )
})
