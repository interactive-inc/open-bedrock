import { DecisionTaskEntity } from "@system/domain/entities/decision-task.entity"
import { DecisionEntity } from "@system/domain/entities/decision.entity"
import { HumanAttestationEntity } from "@system/domain/entities/human-attestation.entity"
import { InvalidSystemWorkflowError } from "@system/domain/errors"
import { proposalDigestSchema } from "@system/domain/schemas/workflow/system-case-reference.schema"
import { describe, expect, test } from "bun:test"

const decidedAt = new Date("2026-08-16T00:00:00.000Z")
const digest = proposalDigestSchema.parse("a".repeat(64))

function createTask(): DecisionTaskEntity {
  const task = DecisionTaskEntity.create({
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

function createAttestation(id: string, accountId: string): HumanAttestationEntity {
  const attestation = HumanAttestationEntity.create({
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

describe("DecisionEntity", () => {
  test("Taskのquorumを満たす証明群だけから確定判断を作る", () => {
    const task = createTask()
    const first = createAttestation("attestation-1", "approver-1")
    const second = createAttestation("attestation-2", "approver-2")

    expect(DecisionEntity.create(task, [first], decidedAt)).toBeInstanceOf(
      InvalidSystemWorkflowError,
    )
    const decision = DecisionEntity.create(task, [first, second], decidedAt)
    expect(decision).toBeInstanceOf(DecisionEntity)
    if (decision instanceof Error) throw decision

    expect(decision.outcome).toBe("approved")
    expect(decision.attestationIds).toEqual([first.id, second.id])
    expect(Object.isFrozen(decision.attestationIds)).toBe(true)
  })
})
