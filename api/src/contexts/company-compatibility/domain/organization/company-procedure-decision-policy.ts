import {
  zApplicationWorkflow,
  type ApplicationWorkflow,
} from "@/contexts/company-compatibility/domain/organization/company-procedure-workflow"
import { z } from "zod"

const policySchema = z
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

export type CompanyProcedureDecisionPolicy = Readonly<{
  schemaVersion: 1
  qualificationContext: "company"
  approverRoles: ReadonlyArray<string>
  workflow: ApplicationWorkflow | null
  workflowRevision: number
}>

export function createCompanyProcedureDecisionPolicy(
  input: Readonly<{
    approverRoles: ReadonlyArray<string>
    workflow: ApplicationWorkflow | null
    workflowRevision?: number
  }>,
): CompanyProcedureDecisionPolicy | Error {
  const parsed = policySchema.safeParse({
    schemaVersion: 1,
    qualificationContext: "company",
    approverRoles: [...input.approverRoles],
    workflow: input.workflow,
    workflowRevision: input.workflowRevision ?? (input.workflow === null ? 0 : 1),
  })

  return parsed.success
    ? parsed.data
    : new Error("invalid Company procedure policy", {
        cause: parsed.error,
      })
}

/** 移行中の旧version 0/raw workflowも読めるが、新規保存は常に正規envelopeへ揃える。 */
export function parseCompanyProcedureDecisionPolicy(
  input: unknown,
): CompanyProcedureDecisionPolicy | Error {
  const current = policySchema.safeParse(input)
  if (current.success) return current.data

  const legacy = z
    .object({
      version: z.literal(0),
      approver_roles: z.array(z.string().min(1).max(100)).max(20),
    })
    .strict()
    .safeParse(input)
  if (legacy.success) {
    return createCompanyProcedureDecisionPolicy({
      approverRoles: legacy.data.approver_roles,
      workflow: null,
      workflowRevision: 0,
    })
  }

  const workflow = zApplicationWorkflow.safeParse(input)
  if (workflow.success) {
    return createCompanyProcedureDecisionPolicy({
      approverRoles: [],
      workflow: workflow.data,
      workflowRevision: 1,
    })
  }

  return new Error("invalid Company procedure policy")
}
