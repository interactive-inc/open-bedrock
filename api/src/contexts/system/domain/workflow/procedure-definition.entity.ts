import { zAccountId, type AccountId } from "@system/domain/auth/account-id"
import { InvalidSystemProposalError } from "@system/domain/workflow/invalid-system-proposal.error"
import { toCanonicalSystemJson } from "@system/domain/workflow/to-canonical-system-json"
import { z } from "zod"

export const procedureKeySchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z][a-z0-9_-]*$/)
  .brand<"ProcedureKey">()

export type ProcedureKey = z.infer<typeof procedureKeySchema>

const propsSchema = z
  .object({
    key: procedureKeySchema,
    revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    title: z.string().min(1).max(500),
    category: z.string().min(1).max(200),
    description: z.string().max(3000).nullable(),
    inputSchemaJson: z.string().min(1).max(1_000_000),
    decisionPolicyJson: z.string().min(1).max(1_000_000),
    completionOperationKey: z.string().min(1).max(100).nullable(),
    createdByAccountId: zAccountId,
    createdAt: z.date(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

/** 入力契約と判断方針を版単位で固定する、製品非依存の手続定義。 */
export class ProcedureDefinition {
  readonly key: ProcedureKey
  readonly revision: number
  readonly title: string
  readonly category: string
  readonly description: string | null
  readonly inputSchemaJson: string
  readonly decisionPolicyJson: string
  readonly completionOperationKey: string | null
  readonly createdByAccountId: AccountId
  readonly #createdAtEpochMilliseconds: number

  private constructor(props: ParsedProps) {
    this.key = props.key
    this.revision = props.revision
    this.title = props.title
    this.category = props.category
    this.description = props.description
    this.inputSchemaJson = props.inputSchemaJson
    this.decisionPolicyJson = props.decisionPolicyJson
    this.completionOperationKey = props.completionOperationKey
    this.createdByAccountId = props.createdByAccountId
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    Object.freeze(this)
  }

  static create(input: {
    key: string
    revision: number
    title: string
    category: string
    description: string | null
    inputSchema: unknown
    decisionPolicy: unknown
    completionOperationKey: string | null
    createdByAccountId: AccountId
    createdAt: Date
  }): ProcedureDefinition | InvalidSystemProposalError {
    const inputSchemaJson = toCanonicalSystemJson(input.inputSchema)
    if (inputSchemaJson instanceof InvalidSystemProposalError) return inputSchemaJson
    const decisionPolicyJson = toCanonicalSystemJson(input.decisionPolicy)
    if (decisionPolicyJson instanceof InvalidSystemProposalError) return decisionPolicyJson
    const parsed = propsSchema.safeParse({
      key: input.key,
      revision: input.revision,
      title: input.title,
      category: input.category,
      description: input.description,
      inputSchemaJson,
      decisionPolicyJson,
      completionOperationKey: input.completionOperationKey,
      createdByAccountId: input.createdByAccountId,
      createdAt: input.createdAt,
    })

    if (!parsed.success) return new InvalidSystemProposalError("invalid_shape")
    if (!Number.isFinite(parsed.data.createdAt.getTime())) {
      return new InvalidSystemProposalError("invalid_chronology")
    }

    return new ProcedureDefinition(parsed.data)
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }
}
