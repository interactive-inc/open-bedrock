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
    message: "I would like to take on the development lead role",
    status: "applied",
  },
  {
    id: 2,
    postingId: 2,
    applicantId: 15,
    message: "I would like to make use of my customer success experience",
    status: "accepted",
  },
]
