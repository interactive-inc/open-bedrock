import { DomainError } from "@/contexts/system/domain/errors"

export class InvalidEmployeeError extends DomainError {
  readonly code = "invalid_employee"

  constructor() {
    super("employee profile is not canonical")
    this.name = "InvalidEmployeeError"
  }
}
