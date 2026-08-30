import { z } from "zod"

/** オンボーディングテンプレート 1 件のレスポンス。 */
export const zAppOnboardingTemplate = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  description: z.string().nullable(),
})

/** オンボーディングテンプレート一覧の要素。task_count を持ち id は持たない。 */
export const zAppOnboardingTemplateListItem = z.object({
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  description: z.string().nullable(),
  task_count: z.number(),
  lifecycle_effect: z.enum(["hire", "retired"]).nullable(),
})

/** オンボーディングテンプレート一覧のレスポンス。 */
export const zAppOnboardingTemplateList = z.object({
  data: z.array(zAppOnboardingTemplateListItem),
  total: z.number(),
})

/** オンボーディングタスク 1 件のレスポンス。 */
export const zAppOnboardingTask = z.object({
  id: z.number(),
  template_task_code: z.string(),
  title: z.string(),
  order: z.number(),
  status: z.string(),
  completed_at: z.string().nullable(),
})

/** オンボーディングタスク一覧のレスポンス。 */
export const zAppOnboardingTaskList = z.object({
  data: z.array(zAppOnboardingTask),
  total: z.number(),
})

/** オンボーディング割り当て 1 件のレスポンス。template_name は割当一覧/作成時のみ含む。 */
export const zAppOnboardingAssignment = z.object({
  id: z.number(),
  employee_code: z.string(),
  employee_name: z.string(),
  template_code: z.string(),
  template_name: z.string().optional(),
  kind: z.string(),
  status: z.string(),
  assigned_at: z.string(),
  tasks: z.array(zAppOnboardingTask),
})

/** オンボーディング割り当て一覧のレスポンス。 */
export const zAppOnboardingAssignmentList = z.object({
  data: z.array(zAppOnboardingAssignment),
  total: z.number(),
})
