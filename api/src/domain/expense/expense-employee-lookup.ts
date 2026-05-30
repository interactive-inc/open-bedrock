import type { Employee } from "@/domain/employee/employee"

// expense が必要とする最小の参照能力だけを定義する（Interface Segregation）。
// employee リポジトリがこれを満たす。
export type ExpenseEmployeeLookup = {
  findById: (employeeId: number) => Promise<Employee | null | Error>
}
