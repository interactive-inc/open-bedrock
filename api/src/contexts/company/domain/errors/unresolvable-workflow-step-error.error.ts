import { DomainError } from "@/contexts/system/domain/errors"

export class UnresolvableWorkflowStepError extends DomainError {
  constructor(readonly stepKey: string) {
    super(`workflow step has insufficient active approvers: ${stepKey}`)
    this.name = "UnresolvableWorkflowStepError"
    Object.freeze(this)
  }
}
