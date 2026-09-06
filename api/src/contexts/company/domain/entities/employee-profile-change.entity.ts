import { z } from "zod"
import type { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyConflictError, CompanyValidationError } from "@/contexts/company/domain/errors"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"

export const employeeProfileVersionSchema = z
  .object({
    employeeId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
    organizationRevision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER - 1),
    personRevision: z
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER - 1),
    effectiveOn: z.string().date(),
  })
  .strict()
export type EmployeeProfileVersion = z.infer<typeof employeeProfileVersionSchema>
export type EmployeeProfileSnapshot = Readonly<{
  version: EmployeeProfileVersion
  employeeCode: string | null
  person: CompanyResourceEntity
}>
export type EmployeeProfileUpdateInput = Readonly<{
  commandId: string
  profile: EmployeeProfileVersion
  reason: string
}>
type Props = EmployeeProfileUpdateInput &
  Readonly<{
    actorAccountId: string
    recordedAt: number
    field: "officialName" | "phone"
    value: string | null
    employeeCode: string | null
  }>

/** 閲覧した人物の版へ、氏名または本人の電話番号の変更を記録する。 */
export class EmployeeProfileChangeEntity {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }

  static create(props: Props): EmployeeProfileChangeEntity | CompanyValidationError {
    const version = employeeProfileVersionSchema.safeParse(props.profile)
    const maximumLength = props.field === "officialName" ? 200 : 64
    if (
      !version.success ||
      !/^\S{1,200}$/.test(props.commandId) ||
      !/^\S{1,255}$/.test(props.actorAccountId) ||
      !Number.isSafeInteger(props.recordedAt) ||
      props.recordedAt < 0 ||
      props.reason.length < 1 ||
      props.reason.length > 1500 ||
      props.reason.trim() !== props.reason ||
      (props.field === "officialName" && props.value === null) ||
      (props.value !== null &&
        (props.value.length < 1 ||
          props.value.length > maximumLength ||
          props.value.trim() !== props.value ||
          props.value.includes("\0")))
    ) {
      return new CompanyValidationError("人物情報の変更内容が不正です", "invalid_employee_profile")
    }
    return new EmployeeProfileChangeEntity(
      Object.freeze({ ...props, profile: Object.freeze(version.data) }),
    )
  }

  toResourceChange(snapshot: EmployeeProfileSnapshot) {
    const profile = this.props.profile
    if (
      snapshot.version.employeeId !== profile.employeeId ||
      snapshot.version.organizationRevision !== profile.organizationRevision ||
      snapshot.version.personRevision !== profile.personRevision ||
      (this.props.employeeCode !== null && snapshot.employeeCode !== this.props.employeeCode)
    ) {
      return new CompanyConflictError(
        "人物情報が変更されています。再読み込みしてください",
        "employee_profile_conflict",
      )
    }
    const person = snapshot.person
    return CompanyResourceChangeEntity.create({
      commandId: `employee-profile:${this.props.commandId}`,
      expectedRevision: profile.organizationRevision,
      actorAccountId: this.props.actorAccountId,
      recordedAt: this.props.recordedAt,
      reason: `${this.props.field}: ${this.props.reason}`,
      resources: [
        {
          organizationId: person.organizationId,
          type: "person",
          id: person.id,
          revision: profile.personRevision + 1,
          state: "active",
          effectiveFrom: restoreCalendarDate(profile.effectiveOn),
          effectiveTo: person.effectiveTo,
          attributes: { ...person.attributes, [this.props.field]: this.props.value },
        },
      ],
    })
  }
}
