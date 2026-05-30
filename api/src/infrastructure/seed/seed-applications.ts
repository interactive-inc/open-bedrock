type SeedApplication = {
  id: number
  templateId: number
  applicantId: number
  status: "pending" | "approved" | "rejected"
  currentStep: string | null
  payload: unknown
  createdAt: string
}

// applicantId は seedEmployees に存在する社員に対応させる。
export const seedApplications: ReadonlyArray<SeedApplication> = [
  {
    id: 1,
    templateId: 1,
    applicantId: 5,
    status: "pending",
    currentStep: "manager_approval",
    payload: { start_date: "2026-06-10", end_date: "2026-06-12", reason: "personal" },
    createdAt: "2026-05-20T01:00:00Z",
  },
  {
    id: 2,
    templateId: 2,
    applicantId: 9,
    status: "pending",
    currentStep: "manager_approval",
    payload: { amount: 12000, category: "transport", note: "client visit" },
    createdAt: "2026-05-22T02:30:00Z",
  },
  {
    id: 3,
    templateId: 3,
    applicantId: 10,
    status: "approved",
    currentStep: null,
    payload: { date: "2026-05-15", reason: "focus work" },
    createdAt: "2026-05-10T00:00:00Z",
  },
  {
    id: 4,
    templateId: 4,
    applicantId: 13,
    status: "rejected",
    currentStep: null,
    payload: { item: "monitor", amount: 45000, reason: "dual monitor setup" },
    createdAt: "2026-05-05T05:00:00Z",
  },
  {
    id: 5,
    templateId: 1,
    applicantId: 5,
    status: "pending",
    currentStep: "manager_approval",
    payload: { start_date: "2026-07-01", end_date: "2026-07-01", reason: "appointment" },
    createdAt: "2026-05-25T03:00:00Z",
  },
]
