import {
  createCompanyProcedureDecisionPolicy,
  type CompanyProcedureDecisionPolicy,
} from "@/contexts/company/domain/organization/company-procedure-decision-policy"
import { zApplicationWorkflow } from "@/contexts/company/domain/organization/company-procedure-workflow"
import { z } from "zod"

const currentPolicy = z
  .object({
    schemaVersion: z.literal(1),
    qualificationContext: z.literal("company"),
    approverRoles: z.array(z.string().min(1).max(100)).max(20),
    workflow: zApplicationWorkflow.nullable(),
    workflowRevision: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((policy, context) => {
    if ((policy.workflow === null) !== (policy.workflowRevision === 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workflowRevision"],
        message: "workflow and workflowRevision must advance together",
      })
    }
  })

export function parseCompanyProcedureDecisionPolicy(
  input: unknown,
): CompanyProcedureDecisionPolicy | Error {
  const current = currentPolicy.safeParse(input)
  if (current.success) return current.data
  const previous = z
    .object({
      version: z.literal(0),
      approver_roles: z.array(z.string().min(1).max(100)).max(20),
    })
    .strict()
    .safeParse(input)
  if (previous.success) {
    return createCompanyProcedureDecisionPolicy({
      approverRoles: previous.data.approver_roles,
      workflow: null,
      workflowRevision: 0,
    })
  }
  const workflow = zApplicationWorkflow.safeParse(input)
  return workflow.success
    ? createCompanyProcedureDecisionPolicy({
        approverRoles: [],
        workflow: workflow.data,
        workflowRevision: 1,
      })
    : new Error("invalid Company procedure policy")
}
