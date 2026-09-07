import { z } from "zod"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyConflictError, CompanyValidationError } from "@/contexts/company/domain/errors"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import type { OrganizationResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/organization-resource-adoption-snapshot.value"

const schema = z
  .object({
    commandId: z.string().regex(/^\S{1,200}$/),
    organizationUnitId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
    expectedRevision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER - 100),
    snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
    observedOn: z.string().date(),
    reason: z.string().trim().min(1).max(1000),
    actorAccountId: z.string().regex(/^\S{1,255}$/),
    recordedAt: z.number().int().nonnegative(),
  })
  .readonly()
type Props = z.infer<typeof schema>
export type OrganizationResourceAdoptionInput = Omit<Props, "actorAccountId" | "recordedAt">

/** 確認した既存の組織履歴を、元の期間IDと訂正版を保って公開正本へ接続する。 */
export class OrganizationResourceAdoptionEntity {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }
  static create(props: Props): OrganizationResourceAdoptionEntity | CompanyValidationError {
    const parsed = schema.safeParse(props)
    if (!parsed.success)
      return new CompanyValidationError(
        "組織の接続内容が不正です",
        "invalid_organization_adoption",
        { cause: parsed.error },
      )
    return new OrganizationResourceAdoptionEntity(parsed.data)
  }
  toChanges(
    snapshot: OrganizationResourceAdoptionSnapshotValue,
  ): ReadonlyArray<CompanyResourceChangeEntity> | CompanyConflictError | CompanyValidationError {
    const source = snapshot.props.value
    if (
      source.organizationUnit.id !== this.props.organizationUnitId ||
      snapshot.props.digest !== this.props.snapshotDigest ||
      (source.organizationRevision ?? 0) !== this.props.expectedRevision ||
      source.bindingOrganizationId !== null ||
      source.pendingOperations !== 0
    )
      return new CompanyConflictError(
        "移行対象が変更されています。再確認してください",
        "organization_resource_adoption_conflict",
      )
    if (source.periods.length === 0 || source.periods.length > 100)
      return new CompanyValidationError(
        "移行する期間履歴は1件から100件で指定してください",
        "invalid_organization_adoption",
      )
    const revisions = new Map<string, number>()
    const changes: CompanyResourceChangeEntity[] = []
    for (const period of source.periods) {
      if (
        period.organizationUnitId !== source.organizationUnit.id ||
        period.revision !== (revisions.get(period.periodId) ?? 0) + 1
      )
        return new CompanyValidationError(
          "組織履歴に欠落または所有者の不一致があります",
          "invalid_organization_adoption",
        )
      revisions.set(period.periodId, period.revision)
      const change = CompanyResourceChangeEntity.create({
        commandId: `org-adoption:${this.props.commandId}:${changes.length}`,
        expectedRevision: this.props.expectedRevision + changes.length,
        actorAccountId: this.props.actorAccountId,
        recordedAt: this.props.recordedAt,
        reason: this.props.reason,
        resources: [
          {
            organizationId: "organization:default",
            type: "organization-unit",
            id: period.periodId,
            revision: period.revision,
            state: period.isVoid === 1 ? "void" : "active",
            effectiveFrom: restoreCalendarDate(period.startsOn),
            effectiveTo: period.endsOn === null ? null : restoreCalendarDate(period.endsOn),
            attributes: {
              organizationUnitId: period.organizationUnitId,
              code: period.code,
              officialName: period.officialName,
              kind: period.kind,
              parentOrganizationUnitId: period.parentOrganizationUnitId,
            },
          },
        ],
      })
      if (change instanceof Error)
        return new CompanyValidationError("組織履歴が不正です", "invalid_organization_adoption", {
          cause: change,
        })
      changes.push(change)
    }
    return changes
  }
}
