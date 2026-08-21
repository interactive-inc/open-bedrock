export const employeeDirectoryErrorCodes = [
  "employee_directory_query_too_large",
  "employee_directory_query_duplicate",
  "employee_directory_record_duplicate",
  "employee_directory_record_unexpected",
  "employee_directory_profile_invalid",
  "employee_directory_code_duplicate",
] as const

export type EmployeeDirectoryErrorCode = (typeof employeeDirectoryErrorCodes)[number]

export class EmployeeDirectoryError extends Error {
  constructor(readonly code: EmployeeDirectoryErrorCode) {
    super(code)
    this.name = "EmployeeDirectoryError"
  }
}
