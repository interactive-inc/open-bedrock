import { DecisionTask } from "@system/domain/workflow/decision-task.entity"
import { Decision } from "@system/domain/workflow/decision.entity"
import { HumanAttestation } from "@system/domain/workflow/human-attestation.entity"
import { InvalidSystemWorkflowError } from "@system/domain/workflow/invalid-system-workflow.error"
import { proposalDigestSchema } from "@system/domain/workflow/system-case-reference"
import { describe, expect, test } from "bun:test"

const decidedAt = new Date("2026-08-16T00:00:00.000Z")
const digest = proposalDigestSchema.parse("a".repeat(64))

function createTask(): DecisionTask {
  const task = DecisionTask.create({
    caseId: "case-1",
    key: "review",
    round: 1,
    candidateAccountIds: ["approver-1", "approver-2"],
    excludedAccountIds: ["creator"],
    requiredApprovals: 2,
    proposalDigest: digest,
    openedAt: decidedAt,
    dueAt: null,
  })
  if (task instanceof Error) throw task

  return task
}

function createAttestation(id: string, accountId: string): HumanAttestation {
  const attestation = HumanAttestation.create({
    id,
    caseId: "case-1",
    taskKey: "review",
    round: 1,
    actorAccountId: accountId,
    representedAccountId: accountId,
    delegationId: null,
    action: "approve",
    proposalDigest: digest,
    comment: null,
    decidedAt,
  })
  if (attestation instanceof Error) throw attestation

  return attestation
}

describe("Decision", () => {
  test("Taskのquorumを満たす証明群だけから確定判断を作る", () => {
    const task = createTask()
    const first = createAttestation("attestation-1", "approver-1")
    const second = createAttestation("attestation-2", "approver-2")

    expect(Decision.create(task, [first], decidedAt)).toBeInstanceOf(InvalidSystemWorkflowError)
    const decision = Decision.create(task, [first, second], decidedAt)
    expect(decision).toBeInstanceOf(Decision)
    if (decision instanceof Error) throw decision

    expect(decision.outcome).toBe("approved")
    expect(decision.attestationIds).toEqual(["attestation-1", "attestation-2"])
    expect(Object.isFrozen(decision.attestationIds)).toBe(true)
  })
})
