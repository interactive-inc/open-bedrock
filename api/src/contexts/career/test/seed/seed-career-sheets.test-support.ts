import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
type SeedCareerSheet = {
  employeeId: EmployeeId
  goalsText: string | null
  strengthsText: string | null
  updatedAt: string
}

export const seedCareerSheets: ReadonlyArray<SeedCareerSheet> = [
  {
    employeeId: toWorkforceEmployeeId(5),
    goalsText: "テックリードとして全体アーキテクチャを牽引したい",
    strengthsText: "設計力とコードレビューによる品質向上",
    updatedAt: "2026-04-01T00:00:00Z",
  },
  {
    employeeId: toWorkforceEmployeeId(6),
    goalsText: "フルスタックエンジニアとして担当領域を広げたい",
    strengthsText: "フロントエンド開発とテスト自動化",
    updatedAt: "2026-04-05T00:00:00Z",
  },
  {
    employeeId: toWorkforceEmployeeId(10),
    goalsText: "営業マネージャーを目指したい",
    strengthsText: "顧客交渉と提案力",
    updatedAt: "2026-04-10T00:00:00Z",
  },
]
