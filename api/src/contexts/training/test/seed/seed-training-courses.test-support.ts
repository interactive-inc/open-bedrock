type SeedTrainingCourse = {
  id: string
  code: string
  title: string
  description: string | null
  durationMinutes: number | null
  category: string
  isRequired: boolean
  status: "active" | "archived"
}

export const seedTrainingCourses: ReadonlyArray<SeedTrainingCourse> = [
  {
    id: "0190002c-0000-7000-8000-000000000001",
    code: "TR-SEC-01",
    title: "情報セキュリティ基礎",
    description: "全従業員必須のセキュリティ研修",
    durationMinutes: 60,
    category: "コンプライアンス",
    isRequired: true,
    status: "active",
  },
  {
    id: "0190002c-0000-7000-8000-000000000002",
    code: "TR-MGR-01",
    title: "新任管理職研修",
    description: null,
    durationMinutes: 180,
    category: "マネジメント",
    isRequired: false,
    status: "active",
  },
  {
    id: "0190002c-0000-7000-8000-000000000003",
    code: "TR-OLD-01",
    title: "旧システム運用",
    description: null,
    durationMinutes: null,
    category: "システム",
    isRequired: false,
    status: "archived",
  },
]
