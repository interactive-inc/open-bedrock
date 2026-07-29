type SeedLeaveBalance = {
  employeeId: number
  fiscalYear: string
  leaveType: "annual" | "special" | "summer" | "child_nursing_care" | "caregiving_leave"
  grantedDays: number
  usedDays: number
  remainingDays: number
}

/** 各 employee は残高管理対象の休暇種別ごとに1行を持ち、remainingDays = grantedDays - usedDays。 */
export const seedLeaveBalances: ReadonlyArray<SeedLeaveBalance> = [
  {
    employeeId: 5,
    fiscalYear: "2026",
    leaveType: "annual",
    grantedDays: 20,
    usedDays: 5,
    remainingDays: 15,
  },
  {
    employeeId: 5,
    fiscalYear: "2026",
    leaveType: "special",
    grantedDays: 5,
    usedDays: 0,
    remainingDays: 5,
  },
  {
    employeeId: 5,
    fiscalYear: "2026",
    leaveType: "summer",
    grantedDays: 3,
    usedDays: 0,
    remainingDays: 3,
  },
  {
    employeeId: 5,
    fiscalYear: "2026",
    leaveType: "child_nursing_care",
    grantedDays: 5,
    usedDays: 0,
    remainingDays: 5,
  },
  {
    employeeId: 5,
    fiscalYear: "2026",
    leaveType: "caregiving_leave",
    grantedDays: 5,
    usedDays: 0,
    remainingDays: 5,
  },
  {
    employeeId: 10,
    fiscalYear: "2026",
    leaveType: "annual",
    grantedDays: 18,
    usedDays: 2,
    remainingDays: 16,
  },
  {
    employeeId: 10,
    fiscalYear: "2026",
    leaveType: "special",
    grantedDays: 5,
    usedDays: 1,
    remainingDays: 4,
  },
  {
    employeeId: 10,
    fiscalYear: "2026",
    leaveType: "summer",
    grantedDays: 3,
    usedDays: 0,
    remainingDays: 3,
  },
  {
    employeeId: 10,
    fiscalYear: "2026",
    leaveType: "child_nursing_care",
    grantedDays: 5,
    usedDays: 0,
    remainingDays: 5,
  },
  {
    employeeId: 10,
    fiscalYear: "2026",
    leaveType: "caregiving_leave",
    grantedDays: 5,
    usedDays: 0,
    remainingDays: 5,
  },
]
