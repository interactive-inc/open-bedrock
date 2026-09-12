import { z } from "zod"
import { CompanyConflictError, CompanyValidationError } from "@/contexts/company/domain/errors"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import type { DefinitionResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/definition-resource-adoption-snapshot.value"

const schema = z
  .object({
    commandId: z.string().regex(/^\S{1,200}$/),
    type: z.enum(["grade", "position"]),
    definitionId: z.number().int().positive(),
    resourceId: z.string().regex(/^\S{1,255}$/),
    expectedRevision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER - 1),
    snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
    observedOn: z.string().date(),
    reason: z.string().trim().min(1).max(1_000),
    actorAccountId: z.string().regex(/^\S{1,255}$/),
    recordedAt: z.number().int().nonnegative(),
  })
  .strict()
  .readonly()
type Props = z.infer<typeof schema>
export type DefinitionResourceAdoptionInput = Omit<Props, "actorAccountId" | "recordedAt">

/** 旧台帳の現在値だけを確認日から公開し、失われた過去の値を作らない。 */
export class DefinitionResourceAdoptionEntity {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }

  static create(props: Props): DefinitionResourceAdoptionEntity | CompanyValidationError {
    const parsed = schema.safeParse(props)
    if (!parsed.success)
      return new CompanyValidationError("定義の接続内容が不正です", "invalid_definition_adoption", {
        cause: parsed.error,
      })
    return new DefinitionResourceAdoptionEntity(parsed.data)
  }

  toChange(snapshot: DefinitionResourceAdoptionSnapshotValue) {
    const source = snapshot.props.value
    if (
      source.organizationRevision !== this.props.expectedRevision ||
      source.definition.type !== this.props.type ||
      source.definition.id !== this.props.definitionId ||
      snapshot.props.digest !== this.props.snapshotDigest
    )
      return new CompanyConflictError(
        "移行対象が変更されています。再確認してください",
        "definition_resource_adoption_conflict",
      )
    const definition = source.definition
    const attributes = {
      code: definition.code,
      officialName: definition.name,
      rank: definition.rank,
      description: definition.description,
    }
    const change = CompanyResourceChangeEntity.create({
      commandId: this.props.commandId,
      expectedRevision: this.props.expectedRevision,
      actorAccountId: this.props.actorAccountId,
      reason: this.props.reason,
      recordedAt: this.props.recordedAt,
      resources: [
        {
          organizationId: "organization:default",
          type: this.props.type,
          id: this.props.resourceId,
          revision: 1,
          state: "active",
          effectiveFrom: restoreCalendarDate(this.props.observedOn),
          effectiveTo: null,
          attributes: this.props.type === "position" ? { ...attributes, jobId: null } : attributes,
        },
      ],
    })
    if (change instanceof Error)
      return new CompanyValidationError(
        "旧定義を公開履歴へ接続できません",
        "invalid_definition_adoption",
        { cause: change },
      )
    return change
  }
}
