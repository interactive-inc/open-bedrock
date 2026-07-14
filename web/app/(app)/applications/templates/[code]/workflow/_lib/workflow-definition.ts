import { z } from "zod"
import type { ApplicationWorkflow } from "@/lib/api/types/application-workflow-types"

// API の正規スキーマは api/src/domain/application/application-workflow.ts。
// Web から API の実行時モジュールを取り込まず、同じ制約で編集途中の入力を安全に検証する。
const codeSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/)

const workflowApproverSelectorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("role"), role_key: codeSchema }),
  z.object({ type: z.literal("employee"), employee_code: codeSchema }),
  z.object({ type: z.literal("direct_manager") }),
  z.object({ type: z.literal("department_manager") }),
  z.object({ type: z.literal("target_department_manager") }),
  z.object({ type: z.literal("management_chain") }),
])

const workflowConditionSchema = z.object({
  source: z.enum(["payload", "applicant"]),
  field: z.string().min(1).max(200),
  operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "exists"]),
  value: z.unknown().optional(),
})

const applicationWorkflowStepSchema = z
  .object({
    key: codeSchema,
    name: z.string().min(1).max(200),
    approvers: z.array(workflowApproverSelectorSchema).min(1).max(20),
    approval_mode: z.enum(["any", "all", "minimum"]).default("any"),
    minimum_approvals: z.number().int().min(1).max(100).optional(),
    condition_mode: z.enum(["all", "any"]).default("all"),
    conditions: z.array(workflowConditionSchema).max(20).default([]),
    due_days: z.number().int().min(0).max(365).nullable().default(null),
    escalation_approvers: z.array(workflowApproverSelectorSchema).max(20).default([]),
    rejection_behavior: z.enum(["reject", "return"]).default("reject"),
    allow_delegation: z.boolean().default(true),
  })
  .superRefine((step, context) => {
    if (step.approval_mode === "minimum" && step.minimum_approvals === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minimum_approvals"],
        message: "minimum_approvals is required for minimum mode",
      })
    }
  })

export const applicationWorkflowSchema = z
  .object({
    version: z.literal(1),
    steps: z.array(applicationWorkflowStepSchema).min(1).max(20),
  })
  .superRefine((workflow, context) => {
    const seen = new Set<string>()

    for (const [index, step] of workflow.steps.entries()) {
      if (seen.has(step.key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "key"],
          message: "step key must be unique",
        })
      }
      seen.add(step.key)
    }
  })

export type WorkflowDefinitionResult =
  | { success: true; workflow: ApplicationWorkflow }
  | { success: false; error: string }

export function parseWorkflowDefinitionJson(value: string): WorkflowDefinitionResult {
  let candidate: unknown
  try {
    candidate = JSON.parse(value)
  } catch {
    return { success: false, error: "ワークフロー定義は有効な JSON で入力してください" }
  }

  const parsed = applicationWorkflowSchema.safeParse(candidate)
  if (parsed.success === false) {
    return { success: false, error: "ワークフロー定義の形式が不正です" }
  }

  return { success: true, workflow: parsed.data }
}
