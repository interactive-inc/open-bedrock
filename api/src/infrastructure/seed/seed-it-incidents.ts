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
    title: "ログイン障害",
    summary: "30分間ログインできない状態が発生した。",
    severity: "high",
    status: "resolved",
    resolvedAt: "2026-01-20T09:30:00Z",
    createdAt: "2026-01-20T09:35:00Z",
  },
  {
    id: 2,
    occurredAt: "2026-02-01T14:00:00Z",
    title: "レポート生成の遅延",
    summary: "月次レポートの生成が通常より遅かった。",
    severity: "low",
    status: "open",
    resolvedAt: null,
    createdAt: "2026-02-01T14:10:00Z",
  },
]
