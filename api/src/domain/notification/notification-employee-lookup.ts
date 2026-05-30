import type { Employee } from "@/domain/employee/employee"

// notification が必要とする最小の参照能力だけを定義する（Interface Segregation）。
// employee リポジトリがこれを満たす。
export type NotificationEmployeeLookup = {
  findByCode: (code: string) => Promise<Employee | null | Error>
}
