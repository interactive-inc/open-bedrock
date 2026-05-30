type SeedSkill = {
  code: string
  name: string
  category: string
}

export const seedSkills: ReadonlyArray<SeedSkill> = [
  { code: "typescript", name: "TypeScript", category: "Programming" },
  { code: "react", name: "React", category: "Frontend" },
  { code: "nodejs", name: "Node.js", category: "Backend" },
  { code: "cloudflare", name: "Cloudflare Workers", category: "Infrastructure" },
  { code: "sql", name: "SQL", category: "Database" },
  { code: "ui_design", name: "UI Design", category: "Design" },
  { code: "project_mgmt", name: "Project Management", category: "Management" },
  { code: "sales", name: "Corporate Sales", category: "Business" },
  { code: "customer_success", name: "Customer Success", category: "Business" },
  { code: "recruiting", name: "Recruiting", category: "Human Resources" },
  { code: "accounting", name: "Accounting", category: "Administration" },
  { code: "english", name: "Business English", category: "Language" },
]
