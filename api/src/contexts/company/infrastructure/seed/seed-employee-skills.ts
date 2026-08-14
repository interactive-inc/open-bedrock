type SeedEmployeeSkill = {
  employeeId: number
  skillCode: string
  level: number
  years: number | null
  note: string | null
}

export const seedEmployeeSkills: ReadonlyArray<SeedEmployeeSkill> = [
  { employeeId: 5, skillCode: "typescript", level: 5, years: 8, note: "テックリード" },
  { employeeId: 5, skillCode: "cloudflare", level: 4, years: 3, note: null },
  { employeeId: 6, skillCode: "typescript", level: 4, years: 4, note: null },
  { employeeId: 6, skillCode: "react", level: 4, years: 4, note: null },
  { employeeId: 7, skillCode: "nodejs", level: 3, years: 2, note: null },
  { employeeId: 8, skillCode: "ui_design", level: 5, years: 7, note: "デザインシステムオーナー" },
  { employeeId: 4, skillCode: "project_mgmt", level: 5, years: 10, note: null },
  { employeeId: 10, skillCode: "sales", level: 4, years: 6, note: null },
  { employeeId: 14, skillCode: "customer_success", level: 4, years: 5, note: null },
  { employeeId: 3, skillCode: "recruiting", level: 3, years: 3, note: null },
  { employeeId: 17, skillCode: "accounting", level: 4, years: 9, note: null },
  { employeeId: 19, skillCode: "typescript", level: 3, years: 2, note: null },
]
