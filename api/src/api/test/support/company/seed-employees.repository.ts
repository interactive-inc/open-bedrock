import { seedPasswordHash } from "@/api/test/support/company/seed-password-hash.repository"

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
  buildEmployee(1, "E001", "Alex Carter", 1, "経営企画部", "最高技術責任者", "root"),
  buildEmployee(2, "E002", "Blake Morgan", 2, "人事部", "人事マネージャー", "manager"),
  buildEmployee(3, "E003", "Casey Reed", 2, "人事部", "人事担当", "member"),
  buildEmployee(4, "E004", "Drew Sato", 3, "開発部", "開発マネージャー", "manager"),
  buildEmployee(5, "E005", "Emery Lane", 3, "開発部", "シニアエンジニア", "member"),
  buildEmployee(6, "E006", "Sage Hayashi", 3, "開発部", "エンジニア", "member"),
  buildEmployee(9, "E009", "Finley Brooks", 4, "営業部", "営業マネージャー", "member"),
  buildEmployee(10, "E010", "Gray Ellis", 4, "営業部", "営業担当", "member"),
  buildEmployee(
    13,
    "E013",
    "Harper Quinn",
    5,
    "カスタマーサクセス部",
    "カスタマーサクセスマネージャー",
    "member",
  ),
  buildEmployee(
    15,
    "E015",
    "Riley Tanaka",
    5,
    "カスタマーサクセス部",
    "カスタマーサクセス担当",
    "member",
  ),
  buildEmployee(16, "E016", "Indi Vaughn", 6, "総務部", "総務マネージャー", "member"),
  buildEmployee(17, "E017", "Jordan Pike", 2, "人事部", "人事担当", "member", "leave"),
  buildEmployee(18, "E018", "Kris Nolan", 4, "営業部", "営業担当", "member", "retired"),
  buildEmployee(99, "E099", "Robin Uchida", 6, "総務部", "総務担当", "member"),
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
