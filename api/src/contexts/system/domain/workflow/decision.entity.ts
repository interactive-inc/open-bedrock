import type { DecisionTask } from "@system/domain/workflow/decision-task.entity"
import type {
  HumanAttestation,
  HumanAttestationId,
} from "@system/domain/workflow/human-attestation.entity"
import { InvalidSystemWorkflowError } from "@system/domain/workflow/invalid-system-workflow.error"
import type { ProposalDigest } from "@system/domain/workflow/system-case-reference"
import type { SystemCaseId } from "@system/domain/workflow/system-case.entity"

/** HumanAttestation群をTask snapshotに照合して確定したSystem判断。 */
export class Decision {
  readonly caseId: SystemCaseId
  readonly taskKey: string
  readonly round: number
  readonly outcome: "approved" | "rejected" | "returned"
  readonly proposalDigest: ProposalDigest
  readonly attestationIds: ReadonlyArray<HumanAttestationId>
  readonly #decidedAtEpochMilliseconds: number

  private constructor(props: {
    task: DecisionTask
    attestations: ReadonlyArray<HumanAttestation>
    outcome: "approved" | "rejected" | "returned"
    decidedAt: Date
  }) {
    this.caseId = props.task.caseId
    this.taskKey = props.task.key
    this.round = props.task.round
    this.outcome = props.outcome
    this.proposalDigest = props.task.proposalDigest
    this.attestationIds = Object.freeze(props.attestations.map((attestation) => attestation.id))
    this.#decidedAtEpochMilliseconds = props.decidedAt.getTime()
    Object.freeze(this)
  }

  static create(
    task: DecisionTask,
    attestations: ReadonlyArray<HumanAttestation>,
    decidedAt: Date,
  ): Decision | InvalidSystemWorkflowError {
    const decidedAtEpochMilliseconds = decidedAt.getTime()

    if (
      !Number.isFinite(decidedAtEpochMilliseconds) ||
      attestations.some(
        (attestation) => attestation.decidedAt.getTime() > decidedAtEpochMilliseconds,
      )
    ) {
      return new InvalidSystemWorkflowError("invalid_chronology")
    }

    const outcome = task.evaluate(attestations)

    if (outcome instanceof InvalidSystemWorkflowError) return outcome
    if (outcome === "pending") return new InvalidSystemWorkflowError("decision_pending")

    return new Decision({ task, attestations, outcome, decidedAt })
  }

  get decidedAt(): Date {
    return new Date(this.#decidedAtEpochMilliseconds)
  }
}
