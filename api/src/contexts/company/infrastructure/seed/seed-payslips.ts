type SeedPayslip = {
  id: number
  employeeId: number
  period: string
  baseSalary: number
  allowances: number
  deductions: number
  netPay: number
  issuedAt: string | null
  status: "draft" | "issued"
}

export const seedPayslips: ReadonlyArray<SeedPayslip> = [
  {
    id: 1,
    employeeId: 5,
    period: "2026-04",
    baseSalary: 300000,
    allowances: 20000,
    deductions: 45000,
    netPay: 275000,
    issuedAt: "2026-04-25T00:00:00Z",
    status: "issued",
  },
  {
    id: 2,
    employeeId: 1,
    period: "2026-04",
    baseSalary: 280000,
    allowances: 10000,
    deductions: 40000,
    netPay: 250000,
    issuedAt: "2026-04-25T00:00:00Z",
    status: "issued",
  },
  {
    id: 3,
    employeeId: 5,
    period: "2026-03",
    baseSalary: 300000,
    allowances: 18000,
    deductions: 44000,
    netPay: 274000,
    issuedAt: "2026-03-25T00:00:00Z",
    status: "issued",
  },
  {
    id: 4,
    employeeId: 1,
    period: "2026-05",
    baseSalary: 280000,
    allowances: 10000,
    deductions: 40000,
    netPay: 250000,
    issuedAt: null,
    status: "draft",
  },
]
