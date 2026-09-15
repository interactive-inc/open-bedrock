export type GovernanceOrgRole = Readonly<{
  code: string
  name: string
  description: string
  assignmentMode: "manual" | "department_manager"
  cardinality: "one" | "per_department" | "many"
  createdAt: "2026-01-01T00:00:00.000Z"
  updatedAt: "2026-01-01T00:00:00.000Z"
}>

const catalogRecordedAt = "2026-01-01T00:00:00.000Z" as const

/** 規程が参照できる組織責任の語彙。任命の事実はCompanyが所有する。 */
export const governanceOrgRoles: ReadonlyArray<GovernanceOrgRole> = Object.freeze([
  {
    code: "board",
    name: "取締役会",
    description: "重要規程の制定・改廃を審議する機関",
    assignmentMode: "manual",
    cardinality: "many",
    createdAt: catalogRecordedAt,
    updatedAt: catalogRecordedAt,
  },
  {
    code: "ciso",
    name: "最高情報セキュリティ責任者",
    description: "情報セキュリティ施策を統括する責任",
    assignmentMode: "manual",
    cardinality: "one",
    createdAt: catalogRecordedAt,
    updatedAt: catalogRecordedAt,
  },
  {
    code: "department-information-security-manager",
    name: "部門情報セキュリティ管理者",
    description: "各部門長が担う情報セキュリティ管理責任",
    assignmentMode: "department_manager",
    cardinality: "per_department",
    createdAt: catalogRecordedAt,
    updatedAt: catalogRecordedAt,
  },
  {
    code: "department-manager",
    name: "部門長",
    description: "各部門の業務執行を管理する責任",
    assignmentMode: "department_manager",
    cardinality: "per_department",
    createdAt: catalogRecordedAt,
    updatedAt: catalogRecordedAt,
  },
  {
    code: "executive-officer",
    name: "担当役員",
    description: "担当領域の業務執行を統括する責任",
    assignmentMode: "manual",
    cardinality: "many",
    createdAt: catalogRecordedAt,
    updatedAt: catalogRecordedAt,
  },
  {
    code: "internal-auditor",
    name: "内部監査責任者",
    description: "規程及び統制の遵守状況を監査する責任",
    assignmentMode: "manual",
    cardinality: "many",
    createdAt: catalogRecordedAt,
    updatedAt: catalogRecordedAt,
  },
  {
    code: "internal-control-committee",
    name: "内部統制委員会",
    description: "規程間の齟齬と内部統制上の論点を調整する機関",
    assignmentMode: "manual",
    cardinality: "many",
    createdAt: catalogRecordedAt,
    updatedAt: catalogRecordedAt,
  },
  {
    code: "management-meeting",
    name: "経営会議",
    description: "重要な業務執行事項を審議する機関",
    assignmentMode: "manual",
    cardinality: "many",
    createdAt: catalogRecordedAt,
    updatedAt: catalogRecordedAt,
  },
  {
    code: "privacy-auditor",
    name: "個人情報保護監査責任者",
    description: "個人情報の取扱いを独立して監査する責任",
    assignmentMode: "manual",
    cardinality: "one",
    createdAt: catalogRecordedAt,
    updatedAt: catalogRecordedAt,
  },
  {
    code: "privacy-manager",
    name: "個人情報保護管理者",
    description: "個人情報の適正な管理を統括する責任",
    assignmentMode: "manual",
    cardinality: "one",
    createdAt: catalogRecordedAt,
    updatedAt: catalogRecordedAt,
  },
  {
    code: "representative-director",
    name: "代表取締役",
    description: "会社を代表して業務執行を統括する責任",
    assignmentMode: "manual",
    cardinality: "one",
    createdAt: catalogRecordedAt,
    updatedAt: catalogRecordedAt,
  },
  {
    code: "section-manager",
    name: "課長",
    description: "各課の業務執行を管理する責任",
    assignmentMode: "manual",
    cardinality: "many",
    createdAt: catalogRecordedAt,
    updatedAt: catalogRecordedAt,
  },
])

export function findGovernanceOrgRole(code: string): GovernanceOrgRole | null {
  return governanceOrgRoles.find((role) => role.code === code) ?? null
}
