type SeedOrgDepartment = {
  code: string
  departmentId: number
  parentCode: string | null
  managerEmployeeCode: string | null
  order: number
}

export const seedOrgDepartments: ReadonlyArray<SeedOrgDepartment> = [
  { code: "D001", departmentId: 1, parentCode: null, managerEmployeeCode: "E001", order: 1 },
  { code: "D002", departmentId: 2, parentCode: "D001", managerEmployeeCode: "E002", order: 1 },
  { code: "D003", departmentId: 3, parentCode: "D001", managerEmployeeCode: "E004", order: 2 },
  { code: "D004", departmentId: 4, parentCode: "D001", managerEmployeeCode: "E009", order: 3 },
  { code: "D005", departmentId: 5, parentCode: "D004", managerEmployeeCode: "E013", order: 1 },
  { code: "D006", departmentId: 6, parentCode: "D001", managerEmployeeCode: "E016", order: 4 },
]
