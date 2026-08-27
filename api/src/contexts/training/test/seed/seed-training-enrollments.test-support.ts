import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
/** courseId は seed-training-courses、employeeId は seed-employees の id を指す。 */
type SeedTrainingEnrollment = {
  id: number
  courseId: number
  employeeId: EmployeeId
  status: "enrolled" | "completed" | "failed"
  completedAt: string | null
  score: number | null
  dueDate: string | null
}

export const seedTrainingEnrollments: ReadonlyArray<SeedTrainingEnrollment> = [
  {
    id: 1,
    courseId: 1,
    employeeId: toWorkforceEmployeeId(5),
    status: "enrolled",
    completedAt: null,
    score: null,
    dueDate: "2026-06-30",
  },
  {
    id: 2,
    courseId: 2,
    employeeId: toWorkforceEmployeeId(4),
    status: "completed",
    completedAt: "2026-05-01T09:00:00Z",
    score: 92,
    dueDate: null,
  },
]
