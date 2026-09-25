import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

/** courseId は seed-training-courses、employeeId は seed-employees の id を指す。 */
type SeedTrainingEnrollment = {
  id: string
  courseId: string
  employeeId: EmployeeId
  status: "enrolled" | "completed" | "failed"
  completedAt: string | null
  score: number | null
  dueDate: string | null
}

export const seedTrainingEnrollments: ReadonlyArray<SeedTrainingEnrollment> = [
  {
    id: "0190002d-0000-7000-8000-000000000001",
    courseId: "0190002c-0000-7000-8000-000000000001",
    employeeId: toWorkforceEmployeeId(5),
    status: "enrolled",
    completedAt: null,
    score: null,
    dueDate: "2026-06-30",
  },
  {
    id: "0190002d-0000-7000-8000-000000000002",
    courseId: "0190002c-0000-7000-8000-000000000002",
    employeeId: toWorkforceEmployeeId(4),
    status: "completed",
    completedAt: "2026-05-01T09:00:00Z",
    score: 92,
    dueDate: null,
  },
]
