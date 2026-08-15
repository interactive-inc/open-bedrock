import type { WorkflowApproverSelector } from "@/contexts/request/domain/application-workflow"

export type WorkflowAccount = Readonly<{
  employeeId: number
  accountId: number
}>

export type WorkflowApproverProvenance = Readonly<{
  selector_index: number
  selector: WorkflowApproverSelector
  evidence: Readonly<Record<string, unknown>>
}>

export type WorkflowApproverMatch = Readonly<{
  employeeId: number
  accountId: number | null
  provenance: WorkflowApproverProvenance
}>
