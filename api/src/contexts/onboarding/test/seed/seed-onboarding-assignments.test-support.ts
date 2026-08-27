import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
type SeedOnboardingAssignment = {
  id: number
  employeeId: EmployeeId
  templateCode: string
  kind: "join" | "leave"
  status: "in_progress" | "completed"
  assignedAt: string
}

export const seedOnboardingAssignments: ReadonlyArray<SeedOnboardingAssignment> = [
  {
    id: 100,
    employeeId: toWorkforceEmployeeId(5),
    templateCode: "engineer_join",
    kind: "join",
    status: "in_progress",
    assignedAt: "2026-05-29T00:00:00Z",
  },
]
