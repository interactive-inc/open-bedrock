import type { ApiClient } from "api/app"
import type { InferRequestType, InferResponseType } from "hono/client"

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <Value>() => Value extends Left ? 1 : 2
      ? true
      : false
    : false

type Assert<Value extends true> = Value

type ExpectedAuditListInput = {
  query?: {
    actor_account_id?: string
    action?: string
    target_type?: string
    target_id?: string
    outcome?: "succeeded" | "denied" | "failed"
    from?: string
    to?: string
    limit?: string
    cursor?: string
  }
}

type ExpectedAuditDetailInput = { param: { event_id: string } }

type ExpectedAuditExportInput = {
  json: {
    actor_account_id?: number
    action?: string
    target_type?: string
    target_id?: string
    outcome?: "succeeded" | "denied" | "failed"
    from: string
    to: string
  }
}

type AuditListInput = InferRequestType<ApiClient["audit-events"]["$get"]>
type AuditExportInput = InferRequestType<ApiClient["audit-event-exports"]["$post"]>

export type AuditRpcContract = [
  Assert<Equal<AuditListInput, ExpectedAuditListInput>>,
  Assert<
    Equal<
      InferRequestType<ApiClient["audit-events"][":event_id"]["$get"]>,
      ExpectedAuditDetailInput
    >
  >,
  Assert<Equal<AuditExportInput, ExpectedAuditExportInput>>,
  Assert<Equal<InferResponseType<ApiClient["audit-event-exports"]["$post"], 200>, string>>,
  Assert<Equal<{} extends AuditListInput ? true : false, true>>,
  Assert<Equal<{ query: { limit: number } } extends AuditListInput ? true : false, false>>,
  Assert<Equal<{ json: {} } extends AuditExportInput ? true : false, false>>,
]
