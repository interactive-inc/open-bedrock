import { CompanyOperationError } from "@/contexts/company/domain/errors/company-operation-error.error"

export class CompanyForbiddenError extends CompanyOperationError {
  constructor(
    message = "この操作を行う権限がありません。",
    code = "forbidden",
    options?: ErrorOptions,
  ) {
    super(message, code, options)
  }
}
