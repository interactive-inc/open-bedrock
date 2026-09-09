import { EmployeeResourceAdoptionEntity } from "@/contexts/company/domain/entities/employee-resource-adoption.entity"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import type { EmployeeResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/employee-resource-adoption-snapshot.value"

export type EmployeeResourceAdoptionBatchInput = Readonly<{
  commandId: string
  expectedRevision: number
  observedOn: CalendarDate
  reason: string
  employees: ReadonlyArray<Readonly<{ employeeId: string; snapshotDigest: string }>>
}>
type Props = EmployeeResourceAdoptionBatchInput &
  Readonly<{ actorAccountId: string; recordedAt: number }>

/** 確認した従業員集合を固定し、全員に同じ履歴照合条件を適用する。 */
export class EmployeeResourceAdoptionBatchEntity {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }

  static create(input: Props): EmployeeResourceAdoptionBatchEntity | CompanyValidationError {
    if (
      !/^\S{1,200}$/.test(input.commandId) ||
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0 ||
      input.expectedRevision > Number.MAX_SAFE_INTEGER - 100 ||
      !isCalendarDate(input.observedOn) ||
      !/^\S{1,255}$/.test(input.actorAccountId) ||
      !Number.isSafeInteger(input.recordedAt) ||
      input.recordedAt < 0 ||
      input.reason.trim() !== input.reason ||
      input.reason.length < 1 ||
      input.reason.length > 1500 ||
      input.employees.length < 1 ||
      input.employees.length > 250 ||
      new Set(input.employees.map((employee) => employee.employeeId)).size !==
        input.employees.length ||
      input.employees.some(
        (employee) =>
          !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(employee.employeeId) ||
          !/^[a-f0-9]{64}$/.test(employee.snapshotDigest),
      )
    )
      return new CompanyValidationError(
        "一括接続の確認内容が不正です",
        "invalid_employee_resource_adoption_batch",
      )

    return new EmployeeResourceAdoptionBatchEntity(
      Object.freeze({
        ...input,
        employees: Object.freeze(
          input.employees
            .toSorted((a, b) => a.employeeId.localeCompare(b.employeeId))
            .map((employee) => Object.freeze({ ...employee })),
        ),
      }),
    )
  }

  confirm(snapshot: EmployeeResourceAdoptionSnapshotValue, commandId: string) {
    const employee = this.props.employees.find(
      (entry) => entry.employeeId === snapshot.props.value.employee.id,
    )
    if (employee === undefined)
      return new CompanyValidationError(
        "確認対象に含まれない従業員です",
        "invalid_employee_resource_adoption_batch",
      )

    const command = EmployeeResourceAdoptionEntity.create({
      commandId,
      ...employee,
      expectedRevision: this.props.expectedRevision,
      observedOn: this.props.observedOn,
      reason: this.props.reason,
      actorAccountId: this.props.actorAccountId,
      recordedAt: this.props.recordedAt,
      reuseExistingHistory: true,
      resources: snapshot.props.value.publicResources.map((resource) => ({
        organizationId: resource.organizationId,
        type: resource.type,
        id: resource.id,
        revision: resource.revision,
        state: resource.state,
        effectiveFrom: restoreCalendarDate(resource.effectiveFrom),
        effectiveTo:
          resource.effectiveTo === null ? null : restoreCalendarDate(resource.effectiveTo),
        attributes: resource.attributes,
      })),
    })
    if (command instanceof Error) return command
    return command.validate(snapshot) ?? command
  }
}
