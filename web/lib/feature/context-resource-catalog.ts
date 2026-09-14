import type { FeatureGroup } from "@/lib/feature/feature-types"

type Resource = {
  owner: "system" | "company"
  group: FeatureGroup
  resource: string
  label: string
  view: string
  models: ReadonlyArray<string>
}

/** 管理対象のドメインモデルと実データを参照する画面。APIの操作・認証フローは含めない。 */
export const contextResourceCatalog: ReadonlyArray<Resource> = [
  {
    owner: "system",
    resource: "accounts",
    group: "system-principal",
    label: "アカウント",
    view: "/system/accounts",
    models: [
      "entities/account.entity.ts",
      "entities/identity-binding.entity.ts",
      "entities/role-binding.entity.ts",
    ],
  },
  {
    owner: "system",
    resource: "principals",
    group: "system-principal",
    label: "認証主体",
    view: "/system/principals",
    models: ["entities/system-principal.entity.ts"],
  },
  {
    owner: "system",
    resource: "roles",
    group: "system-authorization",
    label: "権限ロール",
    view: "/system/roles",
    models: ["entities/iam-role.entity.ts"],
  },
  {
    owner: "system",
    resource: "batch-jobs",
    group: "system-async",
    label: "バッチ実行履歴",
    view: "/system/batches",
    models: ["schemas/batch/system-batch-job-status.schema.ts"],
  },
  {
    owner: "system",
    resource: "connectors",
    group: "system-integration",
    label: "外部接続設定",
    view: "/system/connectors",
    models: ["entities/system-connector.entity.ts"],
  },
  {
    owner: "system",
    resource: "deliveries",
    group: "system-async",
    label: "ジョブと送信キュー",
    view: "/system/deliveries",
    models: ["entities/system-delivery.entity.ts"],
  },
  {
    owner: "system",
    resource: "integration-exchanges",
    group: "system-integration",
    label: "外部連携記録",
    view: "/system/integration-exchanges",
    models: ["entities/integration-exchange.entity.ts"],
  },
  {
    owner: "company",
    resource: "profile",
    group: "company-legal-entity",
    label: "会社と法人",
    view: "/company/profile",
    models: ["company-profile", "legal-entity", "site", "workplace"],
  },
  {
    owner: "company",
    resource: "people",
    group: "company-people",
    label: "人物台帳",
    view: "/company/people",
    models: ["person"],
  },
  {
    owner: "company",
    resource: "employee-directory",
    group: "company-people",
    label: "従業員一覧",
    view: "/company/employee-directory",
    models: ["employee"],
  },
  {
    owner: "company",
    resource: "employments",
    group: "company-people",
    label: "雇用情報",
    view: "/company/employments",
    models: ["employment"],
  },
  {
    owner: "company",
    resource: "organization-tree",
    group: "company-organization",
    label: "組織図",
    view: "/company/departments",
    models: ["organization-unit"],
  },
  {
    owner: "company",
    resource: "organization-snapshots",
    group: "company-organization",
    label: "所属・報告関係・責任割当",
    view: "/company/organization-snapshots",
    models: ["assignment", "reporting-relation", "responsibility-assignment"],
  },
  {
    owner: "company",
    resource: "definitions",
    group: "company-responsibility",
    label: "職務・責任の定義",
    view: "/company/definitions",
    models: [
      "job",
      "organizational-office",
      "responsibility",
      "authority-scope",
      "collective-body",
    ],
  },
  {
    owner: "company",
    resource: "account-employee-links",
    group: "company-system-link",
    label: "アカウントと従業員の紐付け",
    view: "/company/account-employee-links",
    models: ["account-employee-link"],
  },
  {
    owner: "company",
    resource: "personnel-actions",
    group: "company-employment-fact",
    label: "人事発令",
    view: "/company/personnel-actions",
    models: ["personnel-action"],
  },
  {
    owner: "company",
    resource: "employee-events",
    group: "company-employment-fact",
    label: "雇用の変更履歴",
    view: "/company/employee-events",
    models: ["entities/employee-event.entity.ts"],
  },
  {
    owner: "company",
    resource: "grade-definitions",
    group: "company-responsibility",
    label: "等級",
    view: "/company/grades",
    models: ["grade"],
  },
  {
    owner: "company",
    resource: "position-definitions",
    group: "company-responsibility",
    label: "役職",
    view: "/company/positions",
    models: ["position"],
  },
]
