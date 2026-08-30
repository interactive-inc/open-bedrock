import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** 研修コース 1 件のレスポンス。 */
export const zAppTrainingCourse = z.object({
  id: z.number(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  duration_minutes: z.number().nullable(),
  category: z.string(),
  is_required: z.boolean(),
  status: z.string(),
})

/** 研修コース一覧のレスポンス。 */
export const zAppTrainingCourseList = z.object({
  data: z.array(zAppTrainingCourse),
  total: z.number(),
})

/** 受講登録 1 件のレスポンス。 */
export const zAppTrainingEnrollment = z.object({
  id: z.number(),
  course_id: z.number(),
  employee_id: zEmployeeId,
  status: z.string(),
  completed_at: z.string().nullable(),
  score: z.number().nullable(),
  due_date: z.string().nullable(),
})

/** 受講登録一覧のレスポンス。 */
export const zAppTrainingEnrollmentList = z.object({
  data: z.array(zAppTrainingEnrollment),
  total: z.number(),
})
