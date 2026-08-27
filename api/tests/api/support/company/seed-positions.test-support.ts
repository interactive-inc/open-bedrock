type SeedPosition = {
  id: number
  code: string
  name: string
  rank: number
  description: string | null
  createdAt: string
}

/**
 * seed 従業員が使う役職名を rank 順（上位ほど小さい rank）で並べる。
 * name は employees.position の値と一致させる（発令・登録の code 参照で解決される先）。
 */
export const seedPositions: ReadonlyArray<SeedPosition> = [
  {
    id: 1,
    code: "CTO",
    name: "最高技術責任者",
    rank: 1,
    description: "CTO（Chief Technology Officer）",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 2,
    code: "HR_MANAGER",
    name: "人事マネージャー",
    rank: 2,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 3,
    code: "ENGINEERING_MANAGER",
    name: "開発マネージャー",
    rank: 3,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 4,
    code: "SALES_MANAGER",
    name: "営業マネージャー",
    rank: 4,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 5,
    code: "CS_MANAGER",
    name: "カスタマーサクセスマネージャー",
    rank: 5,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 6,
    code: "ADMIN_MANAGER",
    name: "総務マネージャー",
    rank: 6,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 7,
    code: "SENIOR_ENGINEER",
    name: "シニアエンジニア",
    rank: 7,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 8,
    code: "ENGINEER",
    name: "エンジニア",
    rank: 8,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 9,
    code: "HR_STAFF",
    name: "人事担当",
    rank: 9,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 10,
    code: "SALES_STAFF",
    name: "営業担当",
    rank: 10,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 11,
    code: "CS_STAFF",
    name: "カスタマーサクセス担当",
    rank: 11,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 12,
    code: "ADMIN_STAFF",
    name: "総務担当",
    rank: 12,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
]
