import { z } from "zod"

export const leaveTypeSchema = z.enum([
  "annual",
  "special",
  "compensatory",
  "summer",
  "child_nursing_care",
  "prenatal_checkup",
  "menstrual",
  "caregiving_leave",
])

export type LeaveType = z.infer<typeof leaveTypeSchema>

export const leaveStatusSchema = z.enum(["pending", "approved", "rejected"])

export type LeaveStatus = z.infer<typeof leaveStatusSchema>

export const leaveUnitSchema = z.enum(["full_day", "half_day_am", "half_day_pm", "hourly"])

export type LeaveUnit = z.infer<typeof leaveUnitSchema>
