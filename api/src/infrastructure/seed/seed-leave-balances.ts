type SeedLeaveBalance = {
  employeeId: number
  fiscalYear: string
  leaveType: "annual" | "special"
  grantedDays: number
  usedDays: number
  remainingDays: number
}

// 各 employee は annual/special の2行を持ち、remainingDays = grantedDays - usedDays。
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
]
