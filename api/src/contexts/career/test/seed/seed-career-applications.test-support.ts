import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
type SeedCareerApplication = {
  id: number
  postingId: number
  applicantId: EmployeeId
  message: string | null
  status: "applied" | "accepted" | "rejected"
}

export const seedCareerApplications: ReadonlyArray<SeedCareerApplication> = [
  {
    id: 1,
    postingId: 1,
    applicantId: toWorkforceEmployeeId(6),
    message: "開発リード職に挑戦したいです",
    status: "applied",
  },
  {
    id: 2,
    postingId: 2,
    applicantId: toWorkforceEmployeeId(15),
    message: "カスタマーサクセスの経験を活かしたいです",
    status: "accepted",
  },
]
