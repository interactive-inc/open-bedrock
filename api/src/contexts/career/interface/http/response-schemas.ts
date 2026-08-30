import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** ===== career ===== */
export const zAppCareerPosting = z.object({
  id: z.number().nullable(),
  title: z.string(),
  dept_id: z.number().nullable(),
  dept_name: z.string().nullable(),
  required_skills: z.string().nullable(),
  status: z.enum(["open", "closed"]),
})

export const zAppCareerPostingList = z.object({
  data: z.array(zAppCareerPosting),
  total: z.number(),
})

export const zAppCareerApplication = z.object({
  id: z.number().nullable(),
  posting_id: z.number(),
  applicant_id: zEmployeeId,
  message: z.string().nullable(),
  status: z.enum(["applied", "accepted", "rejected"]),
})

export const zAppCareerApplicationList = z.object({
  data: z.array(zAppCareerApplication),
  total: z.number(),
})

export const zAppCareerSheet = z.object({
  employee_id: zEmployeeId,
  goals_text: z.string().nullable(),
  strengths_text: z.string().nullable(),
  updated_at: z.string().nullable(),
})
