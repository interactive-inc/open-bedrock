import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
type SeedEmployeeSkill = {
  employeeId: EmployeeId
  skillCode: string
  level: number
  years: number | null
  note: string | null
}

export const seedEmployeeSkills: ReadonlyArray<SeedEmployeeSkill> = [
  {
    employeeId: toWorkforceEmployeeId(5),
    skillCode: "typescript",
    level: 5,
    years: 8,
    note: "テックリード",
  },
  { employeeId: toWorkforceEmployeeId(5), skillCode: "cloudflare", level: 4, years: 3, note: null },
  { employeeId: toWorkforceEmployeeId(6), skillCode: "typescript", level: 4, years: 4, note: null },
  { employeeId: toWorkforceEmployeeId(6), skillCode: "react", level: 4, years: 4, note: null },
  {
    employeeId: toWorkforceEmployeeId(4),
    skillCode: "project_mgmt",
    level: 5,
    years: 10,
    note: null,
  },
  { employeeId: toWorkforceEmployeeId(10), skillCode: "sales", level: 4, years: 6, note: null },
  {
    employeeId: toWorkforceEmployeeId(15),
    skillCode: "customer_success",
    level: 4,
    years: 5,
    note: null,
  },
  { employeeId: toWorkforceEmployeeId(3), skillCode: "recruiting", level: 3, years: 3, note: null },
  {
    employeeId: toWorkforceEmployeeId(17),
    skillCode: "accounting",
    level: 4,
    years: 9,
    note: null,
  },
]
