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
    name: "エンジニア入社チェックリスト",
    kind: "join",
    description: "新入エンジニアの初期セットアップ",
    tasks: [
      { code: "issue_pc", title: "PCを貸与する", order: 1, ownerRole: "hr" },
      { code: "create_account", title: "各種アカウントを作成する", order: 2, ownerRole: "root" },
    ],
  },
  {
    id: 2,
    code: "common_leave",
    name: "共通退職チェックリスト",
    kind: "leave",
    description: null,
    tasks: [{ code: "return_pc", title: "PCを返却する", order: 1, ownerRole: "hr" }],
  },
]
