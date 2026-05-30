type SeedKnowledgeArticle = {
  id: number
  title: string
  category: string
  tags: string | null
  bodyMd: string
  authorId: number
  createdAt: string
}

export const seedKnowledgeArticles: ReadonlyArray<SeedKnowledgeArticle> = [
  {
    id: 1,
    title: "Remote Work Policy",
    category: "Policy",
    tags: "remote,attendance,wfh",
    bodyMd:
      "## Remote Work Policy\n\nUp to three days of remote work per week are allowed. Submit a remote work request in advance.",
    authorId: 2,
    createdAt: "2026-01-05T00:00:00Z",
  },
  {
    id: 2,
    title: "Expense Reimbursement Procedure",
    category: "Accounting",
    tags: "expense,reimbursement,advance",
    bodyMd:
      "## Expense Reimbursement\n\nAttach receipts and submit advanced expenses through the expense request. The cutoff is the last day of each month.",
    authorId: 16,
    createdAt: "2026-01-10T00:00:00Z",
  },
  {
    id: 3,
    title: "Onboarding Guide",
    category: "Onboarding",
    tags: "onboarding,training,newcomer",
    bodyMd:
      "## Onboarding\n\nAccounts are issued on day one, department training happens in week one, and a one-on-one is held in the first month.",
    authorId: 3,
    createdAt: "2026-02-01T00:00:00Z",
  },
  {
    id: 4,
    title: "Goal Setting and Evaluation",
    category: "Evaluation",
    tags: "goal,evaluation,MBO",
    bodyMd:
      "## Goal Setting\n\nGoals are set each half year and evaluated in three stages: self evaluation, manager evaluation, and final evaluation.",
    authorId: 2,
    createdAt: "2026-02-15T00:00:00Z",
  },
  {
    id: 5,
    title: "Meeting Room Booking Rules",
    category: "Administration",
    tags: "meeting room,booking,facility",
    bodyMd:
      "## Meeting Room Booking\n\nBook rooms with the karte room command. Restore the room to its original state after use.",
    authorId: 16,
    createdAt: "2026-03-01T00:00:00Z",
  },
  {
    id: 6,
    title: "Information Security Policy",
    category: "Security",
    tags: "security,information management,compliance",
    bodyMd:
      "## Information Security\n\nDo not take confidential information off premises and change your password regularly.",
    authorId: 1,
    createdAt: "2026-03-10T00:00:00Z",
  },
]
