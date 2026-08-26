import { CompanyOperationError } from "@/contexts/company/domain/errors/company-operation-error.error"

export class CompanyUnexpectedError extends CompanyOperationError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "unexpected", options)
  }
}
