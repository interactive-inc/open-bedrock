type SeedOnboardingTemplateTask = {
  code: string
  title: string
  order: number
  ownerRole: string | null
}

type SeedOnboardingTemplate = {
  id: number
  code: string
  name: string
  kind: "join" | "leave"
  description: string | null
  tasks: ReadonlyArray<SeedOnboardingTemplateTask>
}

export const seedOnboardingTemplates: ReadonlyArray<SeedOnboardingTemplate> = [
  {
    id: 1,
    code: "engineer_join",
    name: "Engineer Onboarding Checklist",
    kind: "join",
    description: "Initial setup for new engineers",
    tasks: [
      { code: "issue_pc", title: "Issue a laptop", order: 1, ownerRole: "hr" },
      { code: "create_account", title: "Create accounts", order: 2, ownerRole: "admin" },
    ],
  },
  {
    id: 2,
    code: "common_leave",
    name: "Common Offboarding Checklist",
    kind: "leave",
    description: null,
    tasks: [{ code: "return_pc", title: "Return the laptop", order: 1, ownerRole: "hr" }],
  },
]
