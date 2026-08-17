import type { WorkflowApproverSelector } from "@/contexts/company-compatibility/domain/organization/company-procedure-workflow"
import type { AccountId } from "@system/domain/auth/account-id"

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
