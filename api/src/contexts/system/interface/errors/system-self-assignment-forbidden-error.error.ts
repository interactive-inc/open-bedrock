import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemSelfAssignmentForbiddenError extends SystemHTTPException {
  constructor() {
    super({ status: 403, code: "self_assignment", detail: "self assignment is forbidden" })
  }
}
