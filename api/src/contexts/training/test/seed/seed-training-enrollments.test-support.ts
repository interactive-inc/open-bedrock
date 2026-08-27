/** courseId は seed-training-courses、employeeId は seed-employees の id を指す。 */
type SeedTrainingEnrollment = {
  id: number
  courseId: number
  employeeId: number
  status: "enrolled" | "completed" | "failed"
  completedAt: string | null
  score: number | null
  dueDate: string | null
}

export const seedTrainingEnrollments: ReadonlyArray<SeedTrainingEnrollment> = [
  {
    id: 1,
    courseId: 1,
    employeeId: 5,
    status: "enrolled",
    completedAt: null,
    score: null,
    dueDate: "2026-06-30",
  },
  {
    id: 2,
    courseId: 2,
    employeeId: 4,
    status: "completed",
    completedAt: "2026-05-01T09:00:00Z",
    score: 92,
    dueDate: null,
  },
]
