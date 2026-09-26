import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { testOrganizationUnitId } from "@tests/api/support/company/test-organization-unit-id"
import type {
  EmployeeId,
  OrganizationUnitId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"

type SeedExpense = {
  id: string
  employeeId: EmployeeId
  organizationUnitId: OrganizationUnitId
  category: "transport" | "supplies" | "entertainment" | "books" | "other"
  amount: number
  spentAt: string
  note: string | null
  status: "pending" | "approved" | "rejected" | "settled"
  createdAt: string
}

/** employeeId は seedEmployees に存在する社員に対応させる。 */
export const seedExpenses: ReadonlyArray<SeedExpense> = [
  {
    id: "0190004e-0000-7000-8000-000000000001",
    employeeId: toWorkforceEmployeeId(5),
    organizationUnitId: testOrganizationUnitId("D003"),
    category: "transport",
    amount: 1200,
    spentAt: "2026-05-10",
    note: "取引先訪問",
    status: "pending",
    createdAt: "2026-05-11T01:00:00Z",
  },
  {
    id: "0190004e-0000-7000-8000-000000000002",
    employeeId: toWorkforceEmployeeId(5),
    organizationUnitId: testOrganizationUnitId("D003"),
    category: "books",
    amount: 3300,
    spentAt: "2026-05-12",
    note: null,
    status: "approved",
    createdAt: "2026-05-13T02:00:00Z",
  },
  {
    id: "0190004e-0000-7000-8000-000000000003",
    employeeId: toWorkforceEmployeeId(10),
    organizationUnitId: testOrganizationUnitId("D004"),
    category: "entertainment",
    amount: 8800,
    spentAt: "2026-05-14",
    note: "チーム懇親会",
    status: "pending",
    createdAt: "2026-05-15T03:00:00Z",
  },
]
