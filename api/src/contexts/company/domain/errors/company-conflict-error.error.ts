import { CompanyOperationError } from "@/contexts/company/domain/errors/company-operation-error.error"

export class CompanyConflictError extends CompanyOperationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)
  }
}
