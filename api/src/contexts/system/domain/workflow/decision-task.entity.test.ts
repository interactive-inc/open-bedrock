import { DecisionTask } from "@system/domain/workflow/decision-task.entity"
import { HumanAttestation } from "@system/domain/workflow/human-attestation.entity"
import { InvalidSystemWorkflowError } from "@system/domain/workflow/invalid-system-workflow.error"
import { proposalDigestSchema } from "@system/domain/workflow/system-case-reference"
import { describe, expect, test } from "bun:test"

const OPENED_AT = new Date("2026-08-16T00:00:00.000Z")
const DIGEST = proposalDigestSchema.parse("a".repeat(64))

function taskInput(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    caseId: "case-1",
    key: "manager-approval",
    round: 1,
    candidateAccountIds: ["account-2", "account-3"],
    excludedAccountIds: ["account-1"],
    requiredApprovals: 2,
    proposalDigest: DIGEST,
    openedAt: OPENED_AT,
    dueAt: null,
    ...overrides,
  }
}

function requireTask(input: unknown): DecisionTask {
  const task = DecisionTask.create(input)
  expect(task).toBeInstanceOf(DecisionTask)
  if (task instanceof Error) throw task

  return task
}

function requireAttestation(props: {
  id: string
  actorAccountId: string
  representedAccountId: string
  delegationId: string | null
  action: "approve" | "reject" | "return"
}): HumanAttestation {
  const attestation = HumanAttestation.create({
    id: props.id,
    caseId: "case-1",
    taskKey: "manager-approval",
    round: 1,
    actorAccountId: props.actorAccountId,
    representedAccountId: props.representedAccountId,
    delegationId: props.delegationId,
    action: props.action,
    proposalDigest: DIGEST,
    comment: null,
    decidedAt: OPENED_AT,
  })
  expect(attestation).toBeInstanceOf(HumanAttestation)
  if (attestation instanceof Error) throw attestation

  return attestation
}

describe("DecisionTask", () => {
  test("開始時snapshotの候補者とquorumだけで結果を決める", () => {
    const task = requireTask(taskInput())
    const first = requireAttestation({
      id: "decision-1",
      actorAccountId: "account-2",
      representedAccountId: "account-2",
      delegationId: null,
      action: "approve",
    })
    const second = requireAttestation({
      id: "decision-2",
      actorAccountId: "account-4",
      representedAccountId: "account-3",
      delegationId: "delegation-1",
      action: "approve",
    })

    expect(task.evaluate([first])).toBe("pending")
    expect(task.evaluate([first, second])).toBe("approved")
  })

  test("却下と差戻しをquorumより優先する", () => {
    const task = requireTask(taskInput())
    const rejection = requireAttestation({
      id: "decision-1",
      actorAccountId: "account-2",
      representedAccountId: "account-2",
      delegationId: null,
      action: "reject",
    })
    const returned = requireAttestation({
      id: "decision-2",
      actorAccountId: "account-3",
      representedAccountId: "account-3",
      delegationId: null,
      action: "return",
    })

    expect(task.evaluate([rejection])).toBe("rejected")
    expect(task.evaluate([returned])).toBe("returned")
  })

  test("候補重複、除外主体、quorum超過を拒否する", () => {
    expect(
      DecisionTask.create(taskInput({ candidateAccountIds: ["account-2", "account-2"] })),
    ).toBeInstanceOf(InvalidSystemWorkflowError)
    expect(
      DecisionTask.create(taskInput({ excludedAccountIds: ["account-1", "account-2"] })),
    ).toBeInstanceOf(InvalidSystemWorkflowError)
    expect(DecisionTask.create(taskInput({ requiredApprovals: 3 }))).toBeInstanceOf(
      InvalidSystemWorkflowError,
    )
  })

  test("同じactor、同じrepresented主体、候補外主体の判断を拒否する", () => {
    const task = requireTask(taskInput())
    const first = requireAttestation({
      id: "decision-1",
      actorAccountId: "account-2",
      representedAccountId: "account-2",
      delegationId: null,
      action: "approve",
    })
    const duplicate = requireAttestation({
      id: "decision-2",
      actorAccountId: "account-2",
      representedAccountId: "account-3",
      delegationId: "delegation-1",
      action: "approve",
    })
    const ineligible = requireAttestation({
      id: "decision-3",
      actorAccountId: "account-4",
      representedAccountId: "account-4",
      delegationId: null,
      action: "approve",
    })

    expect(task.evaluate([first, duplicate])).toBeInstanceOf(InvalidSystemWorkflowError)
    expect(task.evaluate([ineligible])).toBeInstanceOf(InvalidSystemWorkflowError)
  })

  test("却下の後ろに不正な証明があっても検証を打ち切らない", () => {
    const task = requireTask(taskInput())
    const rejection = requireAttestation({
      id: "decision-1",
      actorAccountId: "account-2",
      representedAccountId: "account-2",
      delegationId: null,
      action: "reject",
    })
    const ineligible = requireAttestation({
      id: "decision-2",
      actorAccountId: "account-4",
      representedAccountId: "account-4",
      delegationId: null,
      action: "approve",
    })

    expect(task.evaluate([rejection, ineligible])).toBeInstanceOf(InvalidSystemWorkflowError)
  })
})
