import type { Employee } from "@/domain/employee/employee"

// payroll が対象社員の解決に必要とする最小の参照能力だけを定義する（Interface Segregation）。
export type PayrollEmployeeLookup = {
  findByCode: (code: string) => Promise<Employee | null | Error>
}
