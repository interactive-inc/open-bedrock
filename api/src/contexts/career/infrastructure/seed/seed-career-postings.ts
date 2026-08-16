type SeedCareerPosting = {
  id: number
  title: string
  deptId: number | null
  deptName: string | null
  requiredSkills: string | null
  status: "open" | "closed"
}

export const seedCareerPostings: ReadonlyArray<SeedCareerPosting> = [
  {
    id: 1,
    title: "プロダクト開発リード",
    deptId: 3,
    deptName: "開発部",
    requiredSkills: "typescript,project_mgmt",
    status: "open",
  },
  {
    id: 2,
    title: "カスタマーサクセスマネージャー",
    deptId: 5,
    deptName: "カスタマーサクセス部",
    requiredSkills: "customer_success,english",
    status: "open",
  },
  {
    id: 3,
    title: "経営企画スペシャリスト",
    deptId: 1,
    deptName: "経営企画部",
    requiredSkills: "accounting,project_mgmt",
    status: "closed",
  },
]
