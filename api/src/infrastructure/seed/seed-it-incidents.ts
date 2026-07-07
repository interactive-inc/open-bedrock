type SeedItIncident = {
  id: number
  occurredAt: string
  title: string
  summary: string
  severity: string | null
  status: "open" | "resolved"
  resolvedAt: string | null
  createdAt: string
}

export const seedItIncidents: ReadonlyArray<SeedItIncident> = [
  {
    id: 1,
    occurredAt: "2026-01-20T09:00:00Z",
    title: "Login outage",
    summary: "Users could not sign in for 30 minutes.",
    severity: "high",
    status: "resolved",
    resolvedAt: "2026-01-20T09:30:00Z",
    createdAt: "2026-01-20T09:35:00Z",
  },
  {
    id: 2,
    occurredAt: "2026-02-01T14:00:00Z",
    title: "Slow report generation",
    summary: "Monthly reports took longer than usual.",
    severity: "low",
    status: "open",
    resolvedAt: null,
    createdAt: "2026-02-01T14:10:00Z",
  },
]
