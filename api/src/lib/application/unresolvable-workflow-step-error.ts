/**
 * ステップの active な承認者が必要数に満たず、スナップショットを解決できないときに返す
 */
export class UnresolvableWorkflowStepError extends Error {
  constructor(readonly stepKey: string) {
    super(`workflow step has insufficient active approvers: ${stepKey}`)
    this.name = "UnresolvableWorkflowStepError"
    Object.freeze(this)
  }
}
