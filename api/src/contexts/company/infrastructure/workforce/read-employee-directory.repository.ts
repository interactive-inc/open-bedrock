import { EmployeeDirectoryError } from "@/contexts/company/domain/workforce/employee-directory-error"
import { isCanonicalEmployee } from "@/contexts/company/domain/workforce/is-canonical-employee"
import type { Employee } from "@/contexts/company/domain/workforce/workforce-schedule"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"

export const employeeDirectoryBatchLimit = 100

export type EmployeeDirectoryReadPortResult =
  | Readonly<{ ok: true; employees: ReadonlyArray<Employee> }>
  | Readonly<{ ok: false; cause: unknown }>

export type EmployeeDirectoryReadPort = Readonly<{
  findByEmployeeIds(
    employeeIds: ReadonlyArray<EmployeeId>,
  ): Promise<EmployeeDirectoryReadPortResult>
}>

export type ReadEmployeeDirectoryResult =
  | Readonly<{
      kind: "found"
      employees: ReadonlyArray<Employee>
      missingEmployeeIds: ReadonlyArray<EmployeeId>
    }>
  | Readonly<{ kind: "invalid_query"; error: EmployeeDirectoryError }>
  | Readonly<{ kind: "invalid_directory"; error: EmployeeDirectoryError }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

type Props = Readonly<{
  port: EmployeeDirectoryReadPort
}>

type RecordValidationProps = Readonly<{
  employee: Employee
  requestedEmployeeIds: ReadonlySet<EmployeeId>
  returnedEmployeeIds: ReadonlySet<EmployeeId>
  returnedEmployeeCodes: ReadonlySet<string>
}>

/** opaque Employee IDをCompany所有profileへ決定的かつfail closedに解決する。 */
export class ReadEmployeeDirectory {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async execute(employeeIds: ReadonlyArray<EmployeeId>): Promise<ReadEmployeeDirectoryResult> {
    const requestedEmployeeIds = [...employeeIds]
    const queryError = this.getQueryError(requestedEmployeeIds)
    if (queryError !== null) return { kind: "invalid_query", error: queryError }
    if (requestedEmployeeIds.length === 0) {
      return { kind: "found", employees: [], missingEmployeeIds: [] }
    }

    const loaded = await this.load(requestedEmployeeIds)
    if (!loaded.ok) return { kind: "unavailable", cause: loaded.cause }

    const directoryError = this.getDirectoryError(requestedEmployeeIds, loaded.employees)
    if (directoryError !== null) return { kind: "invalid_directory", error: directoryError }

    return {
      kind: "found",
      employees: this.toRequestedOrder(requestedEmployeeIds, loaded.employees),
      missingEmployeeIds: this.toMissingEmployeeIds(requestedEmployeeIds, loaded.employees),
    }
  }

  private getQueryError(employeeIds: ReadonlyArray<EmployeeId>): EmployeeDirectoryError | null {
    if (employeeIds.length > employeeDirectoryBatchLimit) {
      return new EmployeeDirectoryError("employee_directory_query_too_large")
    }
    if (new Set(employeeIds).size !== employeeIds.length) {
      return new EmployeeDirectoryError("employee_directory_query_duplicate")
    }

    return null
  }

  private async load(
    employeeIds: ReadonlyArray<EmployeeId>,
  ): Promise<EmployeeDirectoryReadPortResult> {
    try {
      return await this.props.port.findByEmployeeIds(employeeIds)
    } catch (cause) {
      return { ok: false, cause }
    }
  }

  private getDirectoryError(
    employeeIds: ReadonlyArray<EmployeeId>,
    employees: ReadonlyArray<Employee>,
  ): EmployeeDirectoryError | null {
    const requestedEmployeeIds = new Set(employeeIds)
    const returnedEmployeeIds = new Set<EmployeeId>()
    const returnedEmployeeCodes = new Set<string>()

    for (const employee of employees) {
      const recordError = this.getRecordError({
        employee,
        requestedEmployeeIds,
        returnedEmployeeIds,
        returnedEmployeeCodes,
      })
      if (recordError !== null) return recordError

      returnedEmployeeIds.add(employee.id)
      if (employee.employeeCode !== null) returnedEmployeeCodes.add(employee.employeeCode)
    }

    return null
  }

  private getRecordError(props: RecordValidationProps): EmployeeDirectoryError | null {
    if (!props.requestedEmployeeIds.has(props.employee.id)) {
      return new EmployeeDirectoryError("employee_directory_record_unexpected")
    }
    if (props.returnedEmployeeIds.has(props.employee.id)) {
      return new EmployeeDirectoryError("employee_directory_record_duplicate")
    }
    if (!isCanonicalEmployee(props.employee)) {
      return new EmployeeDirectoryError("employee_directory_profile_invalid")
    }
    if (
      props.employee.employeeCode !== null &&
      props.returnedEmployeeCodes.has(props.employee.employeeCode)
    ) {
      return new EmployeeDirectoryError("employee_directory_code_duplicate")
    }

    return null
  }

  private toRequestedOrder(
    employeeIds: ReadonlyArray<EmployeeId>,
    employees: ReadonlyArray<Employee>,
  ): ReadonlyArray<Employee> {
    const employeesById = new Map(employees.map((employee) => [employee.id, employee]))

    return employeeIds.flatMap((employeeId) => {
      const employee = employeesById.get(employeeId)

      return employee === undefined ? [] : [this.toEmployee(employee)]
    })
  }

  private toEmployee(employee: Employee): Employee {
    return Object.freeze({
      id: employee.id,
      officialName: employee.officialName,
      employeeCode: employee.employeeCode,
      email: employee.email,
      phone: employee.phone,
    })
  }

  private toMissingEmployeeIds(
    employeeIds: ReadonlyArray<EmployeeId>,
    employees: ReadonlyArray<Employee>,
  ): ReadonlyArray<EmployeeId> {
    const foundEmployeeIds = new Set(employees.map((employee) => employee.id))

    return employeeIds.filter((employeeId) => !foundEmployeeIds.has(employeeId))
  }
}
