import { zAccountId, type AccountId } from "@system/domain/auth/account-id"
import { InvalidSystemProposalError } from "@system/domain/workflow/invalid-system-proposal.error"
import {
  procedureKeySchema,
  type ProcedureKey,
} from "@system/domain/workflow/procedure-definition.entity"
import {
  proposalDigestSchema,
  type ProposalDigest,
} from "@system/domain/workflow/system-case-reference"
import { toCanonicalSystemJson } from "@system/domain/workflow/to-canonical-system-json"
import { toSystemProposalDigest } from "@system/domain/workflow/to-system-proposal-digest"
import { z } from "zod"

export const proposalIdSchema = z.string().min(1).max(255).brand<"ProposalId">()
export const proposalSeriesIdSchema = z.string().min(1).max(255).brand<"ProposalSeriesId">()

export type ProposalId = z.infer<typeof proposalIdSchema>
export type ProposalSeriesId = z.infer<typeof proposalSeriesIdSchema>

const propsSchema = z
  .object({
    id: proposalIdSchema,
    seriesId: proposalSeriesIdSchema,
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    procedureKey: procedureKeySchema,
    procedureRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    bodyJson: z.string().min(1).max(1_000_000),
    digest: proposalDigestSchema,
    createdByAccountId: zAccountId,
    supersedesProposalId: proposalIdSchema.nullable(),
    createdAt: z.date(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

/** 人間へ提示する内容と実行内容を同じcanonical JSONとdigestへ固定する提案版。 */
export class Proposal {
  readonly id: ProposalId
  readonly seriesId: ProposalSeriesId
  readonly version: number
  readonly procedureKey: ProcedureKey
  readonly procedureRevision: number
  readonly bodyJson: string
  readonly digest: ProposalDigest
  readonly createdByAccountId: AccountId
  readonly supersedesProposalId: ProposalId | null
  readonly #createdAtEpochMilliseconds: number

  private constructor(props: ParsedProps) {
    this.id = props.id
    this.seriesId = props.seriesId
    this.version = props.version
    this.procedureKey = props.procedureKey
    this.procedureRevision = props.procedureRevision
    this.bodyJson = props.bodyJson
    this.digest = props.digest
    this.createdByAccountId = props.createdByAccountId
    this.supersedesProposalId = props.supersedesProposalId
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    Object.freeze(this)
  }

  static async create(input: {
    id: string
    seriesId: string
    version: number
    procedureKey: string
    procedureRevision: number
    body: unknown
    createdByAccountId: AccountId
    supersedesProposalId: string | null
    createdAt: Date
  }): Promise<Proposal | InvalidSystemProposalError> {
    const bodyJson = toCanonicalSystemJson(input.body)
    if (bodyJson instanceof InvalidSystemProposalError) return bodyJson
    const digest = await toSystemProposalDigest(bodyJson)
    if (digest instanceof InvalidSystemProposalError) return digest
    const parsed = propsSchema.safeParse({
      id: input.id,
      seriesId: input.seriesId,
      version: input.version,
      procedureKey: input.procedureKey,
      procedureRevision: input.procedureRevision,
      bodyJson,
      digest,
      createdByAccountId: input.createdByAccountId,
      supersedesProposalId: input.supersedesProposalId,
      createdAt: input.createdAt,
    })

    if (!parsed.success) return new InvalidSystemProposalError("invalid_shape")
    if (!Number.isFinite(parsed.data.createdAt.getTime())) {
      return new InvalidSystemProposalError("invalid_chronology")
    }

    return new Proposal(parsed.data)
  }

  static async restore(input: unknown): Promise<Proposal | InvalidSystemProposalError> {
    const parsed = propsSchema.safeParse(input)
    if (!parsed.success) return new InvalidSystemProposalError("invalid_shape")
    let body: unknown
    try {
      body = JSON.parse(parsed.data.bodyJson)
    } catch (cause) {
      return new InvalidSystemProposalError("invalid_json", { cause })
    }
    const canonical = toCanonicalSystemJson(body)
    if (canonical instanceof InvalidSystemProposalError || canonical !== parsed.data.bodyJson) {
      return new InvalidSystemProposalError("invalid_json")
    }
    const digest = await toSystemProposalDigest(canonical)
    if (digest instanceof InvalidSystemProposalError || digest !== parsed.data.digest) {
      return new InvalidSystemProposalError("digest_mismatch")
    }
    if (!Number.isFinite(parsed.data.createdAt.getTime())) {
      return new InvalidSystemProposalError("invalid_chronology")
    }

    return new Proposal(parsed.data)
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }

  get body(): unknown {
    return JSON.parse(this.bodyJson)
  }
}
