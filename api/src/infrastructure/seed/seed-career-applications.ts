type SeedCareerApplication = {
  id: number
  postingId: number
  applicantId: number
  message: string | null
  status: "applied" | "accepted" | "rejected"
}

export const seedCareerApplications: ReadonlyArray<SeedCareerApplication> = [
  {
    id: 1,
    postingId: 1,
    applicantId: 6,
    message: "開発リード職に挑戦したいです",
    status: "applied",
  },
  {
    id: 2,
    postingId: 2,
    applicantId: 15,
    message: "カスタマーサクセスの経験を活かしたいです",
    status: "accepted",
  },
]
