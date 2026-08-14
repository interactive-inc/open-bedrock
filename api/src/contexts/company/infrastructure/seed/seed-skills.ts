type SeedSkill = {
  code: string
  name: string
  category: string
}

export const seedSkills: ReadonlyArray<SeedSkill> = [
  { code: "typescript", name: "TypeScript", category: "プログラミング" },
  { code: "react", name: "React", category: "フロントエンド" },
  { code: "nodejs", name: "Node.js", category: "バックエンド" },
  { code: "cloudflare", name: "Cloudflare Workers", category: "インフラ" },
  { code: "sql", name: "SQL", category: "データベース" },
  { code: "ui_design", name: "UIデザイン", category: "デザイン" },
  { code: "project_mgmt", name: "プロジェクトマネジメント", category: "マネジメント" },
  { code: "sales", name: "法人営業", category: "ビジネス" },
  { code: "customer_success", name: "カスタマーサクセス", category: "ビジネス" },
  { code: "recruiting", name: "採用", category: "人事" },
  { code: "accounting", name: "経理", category: "総務" },
  { code: "english", name: "ビジネス英語", category: "語学" },
]
