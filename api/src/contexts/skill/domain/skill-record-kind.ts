import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

export const skillRecordKinds = [
  "skill-record",
  "employee-skill-record",
] as const

export const skillRecordKindSchema = z.enum(skillRecordKinds)
export type SkillRecordKind = z.infer<typeof skillRecordKindSchema>

export function encodeEmployeeSkillRecordId(employeeId: string, skillCode: string): string {
  return `${encodeURIComponent(employeeId)}:${encodeURIComponent(skillCode)}`
}

export function decodeEmployeeSkillRecordId(recordId: string) {
  const separator = recordId.indexOf(":")
  if (separator < 1 || separator === recordId.length - 1) return null
  try {
    const employeeId = decodeURIComponent(recordId.slice(0, separator))
    const skillCode = decodeURIComponent(recordId.slice(separator + 1))
    return zEmployeeId.safeParse(employeeId).success && z.string().trim().min(1).max(255).safeParse(skillCode).success
      ? { employeeId, skillCode }
      : null
  } catch {
    return null
  }
}
