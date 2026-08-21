type SeedOrgMembership = {
  departmentCode: string
  employeeCode: string
  managerEmployeeCode: string | null
}

export const seedOrgMemberships: ReadonlyArray<SeedOrgMembership> = [
  { departmentCode: "D001", employeeCode: "E001", managerEmployeeCode: null },
  { departmentCode: "D002", employeeCode: "E002", managerEmployeeCode: "E001" },
  { departmentCode: "D002", employeeCode: "E003", managerEmployeeCode: "E002" },
  { departmentCode: "D003", employeeCode: "E004", managerEmployeeCode: "E001" },
  { departmentCode: "D003", employeeCode: "E005", managerEmployeeCode: "E004" },
  { departmentCode: "D004", employeeCode: "E009", managerEmployeeCode: "E001" },
  { departmentCode: "D004", employeeCode: "E010", managerEmployeeCode: "E009" },
  { departmentCode: "D005", employeeCode: "E013", managerEmployeeCode: "E009" },
]
