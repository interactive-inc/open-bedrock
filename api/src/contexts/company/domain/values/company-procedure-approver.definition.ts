import type { WorkflowApproverSelector } from "@/contexts/company/domain/values/company-procedure-workflow.definition"
import type { AccountId } from "@system/domain/values/account-id.schema"

export type WorkflowAccount = Readonly<{
  employeeId: number
  accountId: AccountId
}>

export type WorkflowApproverProvenance = Readonly<{
  selector_index: number
  selector: WorkflowApproverSelector
  evidence: Readonly<Record<string, unknown>>
}>

export type WorkflowApproverMatch = Readonly<{
  employeeId: number
  accountId: AccountId
  provenance: WorkflowApproverProvenance
}>
