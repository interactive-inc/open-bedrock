import { seedPasswordHash } from "@/infrastructure/seed/seed-password-hash"

type SeedEmployee = {
  id: number
  code: string
  name: string
  email: string
  passwordHash: string
  role: string
  deptId: number | null
  deptName: string | null
  position: string | null
  status: "active" | "leave" | "retired"
}

export const seedEmployees: ReadonlyArray<SeedEmployee> = [
  buildEmployee(1, "E001", "Alex Carter", 1, "Corporate Planning", "CTO", "admin"),
  buildEmployee(2, "E002", "Blake Morgan", 2, "Human Resources", "HR Manager", "member"),
  buildEmployee(3, "E003", "Casey Reed", 2, "Human Resources", "HR Staff", "member"),
  buildEmployee(4, "E004", "Drew Sato", 3, "Engineering", "Engineering Manager", "member"),
  buildEmployee(5, "E005", "Emery Lane", 3, "Engineering", "Senior Engineer", "member"),
  buildEmployee(9, "E009", "Finley Brooks", 4, "Sales", "Sales Manager", "member"),
  buildEmployee(10, "E010", "Gray Ellis", 4, "Sales", "Sales Staff", "member"),
  buildEmployee(13, "E013", "Harper Quinn", 5, "Customer Success", "CS Manager", "member"),
  buildEmployee(16, "E016", "Indi Vaughn", 6, "Administration", "Admin Manager", "member"),
  buildEmployee(17, "E017", "Jordan Pike", 2, "Human Resources", "HR Staff", "member", "leave"),
  buildEmployee(18, "E018", "Kris Nolan", 4, "Sales", "Sales Staff", "member", "retired"),
]

function buildEmployee(
  id: number,
  code: string,
  name: string,
  deptId: number,
  deptName: string,
  position: string,
  role: string,
  status: "active" | "leave" | "retired" = "active",
): SeedEmployee {
  return {
    id,
    code,
    name,
    email: `you+${code.toLowerCase()}@example.com`,
    passwordHash: seedPasswordHash,
    role,
    deptId,
    deptName,
    position,
    status,
  }
}
