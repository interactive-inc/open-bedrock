import type { WorkforceInvariantCode } from "@/contexts/company/domain/values/workforce-invariant.definition"

export class WorkforceInvariantViolationValue {
  constructor(
    readonly code: WorkforceInvariantCode,
    readonly message: string,
  ) {
    Object.freeze(this)
  }
}
