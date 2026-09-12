import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { LeaveRequestRepository } from "@/contexts/leave/infrastructure/repositories/leave-request.repository"
import { expect, test } from "bun:test"
import { SubmitLeaveProcedure } from "@/contexts/leave/application/submit-leave-procedure"
import { createLeaveProcedureTestContext } from "@/contexts/leave/test/leave-procedure.test-support"
import { createTestContextForDatabase } from "@tests/api/support/create-test-context"

test("本人が確認した休暇を提出し、同じ再送で案件を増やさない", async () => {
  const c = await createLeaveProcedureTestContext()
  await c.database.exec(`INSERT INTO system_iam_roles
    (id, key, kind, name, created_at, updated_at) VALUES ('leave-submit-role', 'test:leave-submit', 'custom', 'Leave submission', 0, 0);
    INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('leave-submit-role', 'leave:submit');`)
  await c.database
    .prepare(
      "INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES ('leave-submit-binding', ?1, 'leave-submit-role', 0)",
    )
    .bind(c.creator.accountId)
    .run()
  const base = createTestContextForDatabase(c.database)
  const context = { ...base, env: { ...base.env, NOW: c.at.toISOString() } }
  const application = new SubmitLeaveProcedure(context)
  const command = {
    requestKey: c.submission.requestKey,
    leaveRequestId: c.requestId,
    previousLeaveRequestId: null,
    confirmedContentDigest: c.submission.workflow.proposal.digest,
    session: {
      accountId: c.creator.accountId,
      employeeId: c.creator.employeeId,
      hasPermission: (key: string) => key === "leave:submit",
    },
    tokenVersion: 0,
    createdAt: c.at,
  }
  for (const previousLeaveRequestId of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    expect(await application.run({ ...command, previousLeaveRequestId })).toBeInstanceOf(Error)
  }
  await c.database
    .prepare("UPDATE leave_requests SET consumed_days = 0 WHERE id = ?1")
    .bind(c.requestId)
    .run()
  const altered = await new LeaveRequestRepository(context).findById(c.requestId)
  if (altered === null || altered instanceof Error) throw new Error("request missing")
  const payload = CanonicalSystemJsonValue.create(altered.toProposalBody())
  if (payload instanceof Error) throw payload
  const alteredDigest = await ProposalDigestValue.create(payload)
  if (alteredDigest instanceof Error) throw alteredDigest
  expect(
    await application.run({ ...command, confirmedContentDigest: alteredDigest.toString() }),
  ).toBeInstanceOf(Error)
  expect(
    await c.database.prepare("SELECT count(*) AS count FROM system_cases").first<number>("count"),
  ).toBe(0)
  await c.database
    .prepare("UPDATE leave_requests SET consumed_days = 1 WHERE id = ?1")
    .bind(c.requestId)
    .run()
  const submitted = await application.run(command)
  expect(submitted).not.toBeInstanceOf(Error)
  if (submitted instanceof Error) throw submitted
  expect(submitted.replayed).toBe(false)
  expect(await application.run(command)).toEqual({ binding: submitted.binding, replayed: true })
  expect(
    await application.run({ ...command, confirmedContentDigest: "0".repeat(64) }),
  ).toBeInstanceOf(Error)
  expect(await application.run({ ...command, requestKey: crypto.randomUUID() })).toBeInstanceOf(
    Error,
  )
  expect(
    await c.database.prepare("SELECT count(*) AS count FROM system_cases").first<number>("count"),
  ).toBe(1)
  await c.database
    .prepare("UPDATE system_role_bindings SET revoked_at = ?1 WHERE id = 'leave-submit-binding'")
    .bind(c.at.getTime())
    .run()
  expect(await application.run(command)).toBeInstanceOf(Error)
})
