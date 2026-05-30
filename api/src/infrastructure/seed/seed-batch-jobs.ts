type SeedBatchJob = {
  id: number
  name: string
  status: "running" | "completed" | "failed"
  startedAt: string | null
  finishedAt: string | null
  message: string | null
}

export const seedBatchJobs: ReadonlyArray<SeedBatchJob> = [
  {
    id: 1,
    name: "Nightly employee data sync",
    status: "completed",
    startedAt: "2026-05-29T18:00:00Z",
    finishedAt: "2026-05-29T18:05:00Z",
    message: "Synced 20 records",
  },
  {
    id: 2,
    name: "Goal reminder notifications",
    status: "completed",
    startedAt: "2026-05-29T00:00:00Z",
    finishedAt: "2026-05-29T00:01:00Z",
    message: "Sent 8 notifications",
  },
  {
    id: 3,
    name: "Survey aggregation batch",
    status: "running",
    startedAt: "2026-05-29T09:00:00Z",
    finishedAt: null,
    message: null,
  },
  {
    id: 4,
    name: "Attendance data import",
    status: "failed",
    startedAt: "2026-05-28T20:00:00Z",
    finishedAt: "2026-05-28T20:02:00Z",
    message: "Source file not found",
  },
]
