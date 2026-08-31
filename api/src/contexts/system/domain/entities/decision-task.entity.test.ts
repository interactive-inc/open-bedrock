import { DecisionTaskEntity } from "@system/domain/entities/decision-task.entity"
import { HumanAttestationEntity } from "@system/domain/entities/human-attestation.entity"
import { InvalidSystemWorkflowError } from "@system/domain/errors"
import { proposalDigestSchema } from "@system/domain/schemas/workflow/system-case-reference.schema"
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

function requireTask(input: unknown): DecisionTaskEntity {
  const task = DecisionTaskEntity.create(input)
  expect(task).toBeInstanceOf(DecisionTaskEntity)
  if (task instanceof Error) throw task

  return task
}

function requireAttestation(props: {
  id: string
  actorAccountId: string
  representedAccountId: string
  delegationId: string | null
  action: "approve" | "reject" | "return"
}): HumanAttestationEntity {
  const attestation = HumanAttestationEntity.create({
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
  expect(attestation).toBeInstanceOf(HumanAttestationEntity)
  if (attestation instanceof Error) throw attestation

  return attestation
}

describe("DecisionTaskEntity", () => {
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

  test("合議では参加定足数を満たし、成立不能になるまで少数の反対で閉じない", () => {
    const task = requireTask(
      taskInput({
        candidateAccountIds: ["account-2", "account-3", "account-4", "account-5"],
        requiredApprovals: 3,
        requiredParticipants: 3,
        negativeDecisionRule: "approval-impossible",
      }),
    )
    const rejection = requireAttestation({
      id: "decision-1",
      actorAccountId: "account-2",
      representedAccountId: "account-2",
      delegationId: null,
      action: "reject",
    })
    const secondRejection = requireAttestation({
      id: "decision-2",
      actorAccountId: "account-3",
      representedAccountId: "account-3",
      delegationId: null,
      action: "reject",
    })

    expect(task.evaluate([rejection])).toBe("pending")
    expect(task.evaluate([rejection, secondRejection])).toBe("rejected")
  })

  test("賛成数だけでなく参加定足数も満たしてから合議を承認する", () => {
    const task = requireTask(
      taskInput({
        candidateAccountIds: ["account-2", "account-3", "account-4"],
        requiredApprovals: 2,
        requiredParticipants: 3,
        negativeDecisionRule: "approval-impossible",
      }),
    )
    const first = requireAttestation({
      id: "decision-1",
      actorAccountId: "account-2",
      representedAccountId: "account-2",
      delegationId: null,
      action: "approve",
    })
    const second = requireAttestation({
      id: "decision-2",
      actorAccountId: "account-3",
      representedAccountId: "account-3",
      delegationId: null,
      action: "approve",
    })
    const third = requireAttestation({
      id: "decision-3",
      actorAccountId: "account-4",
      representedAccountId: "account-4",
      delegationId: null,
      action: "reject",
    })

    expect(task.evaluate([first, second])).toBe("pending")
    expect(task.evaluate([first, second, third])).toBe("approved")
  })

  test("候補重複、除外主体、quorum超過を拒否する", () => {
    expect(
      DecisionTaskEntity.create(taskInput({ candidateAccountIds: ["account-2", "account-2"] })),
    ).toBeInstanceOf(InvalidSystemWorkflowError)
    expect(
      DecisionTaskEntity.create(taskInput({ excludedAccountIds: ["account-1", "account-2"] })),
    ).toBeInstanceOf(InvalidSystemWorkflowError)
    expect(DecisionTaskEntity.create(taskInput({ requiredApprovals: 3 }))).toBeInstanceOf(
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
