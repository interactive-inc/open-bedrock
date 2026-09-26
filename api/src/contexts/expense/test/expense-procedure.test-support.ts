import { PublishExpenseProcedure } from "@/contexts/expense/application/publish-expense-procedure"
import { SubmitExpenseProcedure } from "@/contexts/expense/application/submit-expense-procedure"
import { RecordExpenseDecision } from "@/contexts/expense/application/record-expense-decision"
import { CompleteApprovedExpenseProcedure } from "@/contexts/expense/application/complete-approved-expense-procedure"
import { ExpenseProcedureRepository } from "@/contexts/expense/infrastructure/repositories/expense-procedure.repository"
import { openSystemAttachments } from "@system/interface/operations/open-system-attachments"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { createLocalD1CompanyAssignment } from "@tests/d1/support/create-local-d1-company-assignment"
import { execSql } from "@tests/d1/support/exec-sql"

/** migration済みのローカルD1へ実Company APIで主務所属を作り、経費規程へ提出する。 */
export async function createExpenseProcedureTestContext(
  database: D1Database,
  rejectionBehavior: "reject" | "return" = "reject",
) {
  const c = await createLocalD1CompanyAssignment(database)
  // 主務所属の資源IDはUUIDでなければ保存できない。
  const assignment = { ...c.assignment, id: "7b0c52d4-3f4e-4c8a-9a61-2f1e0d5c8b47" }
  const assigned = await c.write([
    { ...assignment, effectiveFrom: c.at.toISOString().slice(0, 10) },
  ])
  if (Number(assigned.status) !== 201)
    throw new Error(`assignment failed ${JSON.stringify(await assigned.json())}`)
  const requester = c.creator
  const first = c.people[1]
  const second = c.people[2]
  if (first === undefined || second === undefined) throw new Error("reviewers missing")
  if (rejectionBehavior === "return") {
    const assignment = c.resources.find((resource) => resource.type === "responsibility-assignment")
    if (assignment === undefined) throw new Error("responsibility missing")
    const change = CompanyResourceChangeEntity.create({
      commandId: crypto.randomUUID(),
      expectedRevision: await c.companyRevision(),
      actorAccountId: requester.accountId,
      reason: "Assign individual return authority",
      recordedAt: c.at.getTime(),
      resources: [
        {
          ...assignment,
          revision: 2,
          attributes: {
            ...assignment.attributes,
            holderType: "employee",
            holderId: first.employeeId,
          },
        },
      ],
    })
    if (change instanceof Error) throw change
    const changed = await new D1CompanyResourceRepository({ database: c.database }).write(change)
    if (changed.kind !== "applied")
      throw new Error("return authority setup failed", { cause: changed })
  }
  await execSql(
    c.database,
    `INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at)
    VALUES ('bdf8c152-9f77-4cf5-85cf-a3495ca3645d','test:expense','custom','Expense approval',0,0);
    INSERT INTO system_iam_role_permissions (role_id,permission_key) VALUES
    ('bdf8c152-9f77-4cf5-85cf-a3495ca3645d','expense:submit'),('bdf8c152-9f77-4cf5-85cf-a3495ca3645d','expense:approve'),('bdf8c152-9f77-4cf5-85cf-a3495ca3645d','expense:procedure:manage');`,
  )
  for (const person of [requester, first, second])
    await c.database
      .prepare(
        "INSERT INTO system_role_bindings (id,account_id,role_id,created_at) VALUES (?1,?2,'bdf8c152-9f77-4cf5-85cf-a3495ca3645d',0)",
      )
      .bind(crypto.randomUUID(), person.accountId)
      .run()
  const session = (person: typeof requester) => ({ ...person, hasPermission: () => true })
  const workflow = {
    version: 1 as const,
    steps: [{ ...c.step, rejection_behavior: rejectionBehavior }],
  }
  const published = await new PublishExpenseProcedure(c.context).run({
    expectedRevision: 0,
    workflow,
    session: session(requester),
    tokenVersion: 0,
    publishedAt: c.at,
  })
  if (published instanceof Error) throw published
  const attachmentId = crypto.randomUUID()
  const attachments = openSystemAttachments(c.context)
  const reserved = await attachments.reserve({
    id: attachmentId,
    ownerAccountId: requester.accountId,
    objectKey: `att/${attachmentId}`,
    contentType: "application/pdf",
    byteSize: 500,
    fileName: "receipt.pdf",
    plaintextSha256: "a".repeat(64),
    wrappedDek: "test-wrapped-key",
    wrappedDekIv: "test-key-iv",
    contentIv: "test-content-iv",
    kekVersion: 1,
    createdAt: c.at,
  })
  if (reserved instanceof Error) throw reserved
  const pending = await attachments.markPending(attachmentId)
  if (pending instanceof Error) throw pending
  const command = {
    requestKey: crypto.randomUUID(),
    session: session(requester),
    tokenVersion: 0,
    category: "supplies" as const,
    amount: 500,
    spentAt: c.at.toISOString().slice(0, 10),
    note: "Replace equipment",
    attachmentIds: [attachmentId],
    createdAt: c.at,
  }
  const submit = new SubmitExpenseProcedure(c.context)
  const repository = new ExpenseProcedureRepository(c.context)
  const create = async () => {
    const submitted = await submit.run(command)
    if (submitted instanceof Error || submitted.request.id === null) throw submitted
    const id = submitted.request.id
    const binding = await repository.findProcedure(id)
    if (binding instanceof Error || binding === null) throw binding
    const decisionTarget = {
      proposalVersion: 1,
      proposalDigest: binding.proposalDigest,
      taskKey: c.step.key,
      taskRound: 1,
    }
    const decide = (person = first, action: "approve" | "reject" = "approve") =>
      new RecordExpenseDecision(c.context).run({
        expenseId: id,
        session: session(person),
        tokenVersion: 0,
        decisionTarget,
        action,
        comment: "Reviewed",
        decidedAt: c.at,
      })
    const complete = (person = second) =>
      new CompleteApprovedExpenseProcedure(c.context).run({
        expenseId: id,
        session: session(person),
        tokenVersion: 0,
        completedAt: c.at,
      })
    const proposal = () => openSystemProposals(c.context).findByNumber(binding.applicationId)
    return { id, binding, decisionTarget, decide, complete, proposal, submitted }
  }
  const revokeFirstVoting = async () => {
    const membership = c.resources.find((resource) => resource.id === "membership:0")
    if (membership === undefined) throw new Error("membership missing")
    const change = CompanyResourceChangeEntity.create({
      commandId: crypto.randomUUID(),
      expectedRevision: await c.companyRevision(),
      actorAccountId: requester.accountId,
      reason: "End voting qualification",
      recordedAt: c.at.getTime(),
      resources: [
        { ...membership, revision: 2, attributes: { ...membership.attributes, voting: false } },
      ],
    })
    if (change instanceof Error) throw change
    const saved = await new D1CompanyResourceRepository({ database: c.database }).write(change)
    if (saved.kind !== "applied") throw new Error("membership change failed", { cause: saved })
  }
  return {
    ...c,
    assignment,
    requester,
    first,
    second,
    session,
    workflow,
    command,
    attachments,
    attachmentId,
    submit,
    repository,
    create,
    revokeFirstVoting,
  }
}
