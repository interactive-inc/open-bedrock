type SeedCareerPosting = {
  id: string
  title: string
  deptId: number | null
  deptName: string | null
  requiredSkills: string | null
  status: "open" | "closed"
}

export const seedCareerPostings: ReadonlyArray<SeedCareerPosting> = [
  {
    id: "0190000d-0000-7000-8000-000000000001",
    title: "プロダクト開発リード",
    deptId: 3,
    deptName: "開発部",
    requiredSkills: "typescript,project_mgmt",
    status: "open",
  },
  {
    id: "0190000d-0000-7000-8000-000000000002",
    title: "カスタマーサクセスマネージャー",
    deptId: 5,
    deptName: "カスタマーサクセス部",
    requiredSkills: "customer_success,english",
    status: "open",
  },
  {
    id: "0190000d-0000-7000-8000-000000000003",
    title: "経営企画スペシャリスト",
    deptId: 1,
    deptName: "経営企画部",
    requiredSkills: "accounting,project_mgmt",
    status: "closed",
  },
]
