import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

type SeedCareerApplication = {
  id: string
  postingId: string
  applicantId: EmployeeId
  message: string | null
  status: "applied" | "accepted" | "rejected"
}

export const seedCareerApplications: ReadonlyArray<SeedCareerApplication> = [
  {
    id: "01900018-0000-7000-8000-000000000001",
    postingId: "01900017-0000-7000-8000-000000000001",
    applicantId: toWorkforceEmployeeId(6),
    message: "開発リード職に挑戦したいです",
    status: "applied",
  },
  {
    id: "01900018-0000-7000-8000-000000000002",
    postingId: "01900017-0000-7000-8000-000000000002",
    applicantId: toWorkforceEmployeeId(15),
    message: "カスタマーサクセスの経験を活かしたいです",
    status: "accepted",
  },
]
