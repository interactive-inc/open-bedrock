import { zAccountId, type AccountId } from "@system/domain/auth/account-id"
import type { HumanAttestation } from "@system/domain/workflow/human-attestation.entity"
import { InvalidSystemWorkflowError } from "@system/domain/workflow/invalid-system-workflow.error"
import {
  proposalDigestSchema,
  type ProposalDigest,
} from "@system/domain/workflow/system-case-reference"
import { systemCaseIdSchema, type SystemCaseId } from "@system/domain/workflow/system-case.entity"
import { z } from "zod"

const propsSchema = z
  .object({
    caseId: systemCaseIdSchema,
    key: z.string().min(1).max(100),
    round: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    candidateAccountIds: z.array(zAccountId).min(1).max(100),
    excludedAccountIds: z.array(zAccountId).max(100),
    requiredApprovals: z.number().int().positive().max(100),
    proposalDigest: proposalDigestSchema,
    openedAt: z.date(),
    dueAt: z.date().nullable(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

export type DecisionTaskOutcome = "pending" | "approved" | "rejected" | "returned"

/** 判断候補、除外主体、quorum、対象digestを開始時点で固定するSystem Task。 */
export class DecisionTask {
  readonly caseId: SystemCaseId
  readonly key: string
  readonly round: number
  readonly candidateAccountIds: ReadonlyArray<AccountId>
  readonly excludedAccountIds: ReadonlyArray<AccountId>
  readonly requiredApprovals: number
  readonly proposalDigest: ProposalDigest
  readonly #openedAtEpochMilliseconds: number
  readonly #dueAtEpochMilliseconds: number | null

  private constructor(props: ParsedProps) {
    this.caseId = props.caseId
    this.key = props.key
    this.round = props.round
    this.candidateAccountIds = Object.freeze([...props.candidateAccountIds])
    this.excludedAccountIds = Object.freeze([...props.excludedAccountIds])
    this.requiredApprovals = props.requiredApprovals
    this.proposalDigest = props.proposalDigest
    this.#openedAtEpochMilliseconds = props.openedAt.getTime()
    this.#dueAtEpochMilliseconds = props.dueAt?.getTime() ?? null
    Object.freeze(this)
  }

  static create(input: unknown): DecisionTask | InvalidSystemWorkflowError {
    const parsed = propsSchema.safeParse(input)

    if (!parsed.success) return new InvalidSystemWorkflowError("invalid_shape", parsed.error)
    if (new Set(parsed.data.candidateAccountIds).size !== parsed.data.candidateAccountIds.length) {
      return new InvalidSystemWorkflowError("duplicate_candidate")
    }
    if (new Set(parsed.data.excludedAccountIds).size !== parsed.data.excludedAccountIds.length) {
      return new InvalidSystemWorkflowError("duplicate_candidate")
    }
    if (
      parsed.data.candidateAccountIds.some((candidateAccountId) =>
        parsed.data.excludedAccountIds.includes(candidateAccountId),
      )
    ) {
      return new InvalidSystemWorkflowError("candidate_excluded")
    }
    if (parsed.data.requiredApprovals > parsed.data.candidateAccountIds.length) {
      return new InvalidSystemWorkflowError("invalid_shape")
    }
    if (
      parsed.data.dueAt !== null &&
      parsed.data.dueAt.getTime() < parsed.data.openedAt.getTime()
    ) {
      return new InvalidSystemWorkflowError("invalid_chronology")
    }

    return new DecisionTask(parsed.data)
  }

  get openedAt(): Date {
    return new Date(this.#openedAtEpochMilliseconds)
  }

  get dueAt(): Date | null {
    return this.#dueAtEpochMilliseconds === null ? null : new Date(this.#dueAtEpochMilliseconds)
  }

  evaluate(
    attestations: ReadonlyArray<HumanAttestation>,
  ): DecisionTaskOutcome | InvalidSystemWorkflowError {
    const actorAccountIds = new Set<AccountId>()
    const representedAccountIds = new Set<AccountId>()

    for (const attestation of attestations) {
      if (
        attestation.caseId !== this.caseId ||
        attestation.taskKey !== this.key ||
        attestation.round !== this.round ||
        attestation.proposalDigest !== this.proposalDigest
      ) {
        return new InvalidSystemWorkflowError("attestation_mismatch")
      }
      if (
        actorAccountIds.has(attestation.actorAccountId) ||
        representedAccountIds.has(attestation.representedAccountId)
      ) {
        return new InvalidSystemWorkflowError("duplicate_attestation")
      }
      if (!this.candidateAccountIds.includes(attestation.representedAccountId)) {
        return new InvalidSystemWorkflowError("ineligible_decider")
      }

      actorAccountIds.add(attestation.actorAccountId)
      representedAccountIds.add(attestation.representedAccountId)
    }

    if (attestations.some((attestation) => attestation.action === "reject")) return "rejected"
    if (attestations.some((attestation) => attestation.action === "return")) return "returned"

    return representedAccountIds.size >= this.requiredApprovals ? "approved" : "pending"
  }
}
