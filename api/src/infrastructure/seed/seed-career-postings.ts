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
    title: "Product Development Lead",
    deptId: 3,
    deptName: "Engineering",
    requiredSkills: "typescript,project_mgmt",
    status: "open",
  },
  {
    id: 2,
    title: "Customer Success Manager",
    deptId: 5,
    deptName: "Customer Success",
    requiredSkills: "customer_success,english",
    status: "open",
  },
  {
    id: 3,
    title: "Corporate Planning Specialist",
    deptId: 1,
    deptName: "Corporate Planning",
    requiredSkills: "accounting,project_mgmt",
    status: "closed",
  },
]
