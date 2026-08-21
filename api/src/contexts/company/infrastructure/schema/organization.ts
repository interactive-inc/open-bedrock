import type { InferSelectModel } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { check, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { organizationUnitKinds } from "@/contexts/company/domain/values/organization-unit.definition"
import { orgAssignmentTypes } from "@/contexts/company/domain/values/org-assignment-type.definition"
import { organizationLifecycleState } from "@/contexts/company/infrastructure/schema/employee-lifecycle"
import type { AccountId } from "@system/domain/values/account-id.schema"

/** Companyが所有する部署マスタ。 */
export const departments = sqliteTable("departments", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
})

export type DepartmentRow = InferSelectModel<typeof departments>

/** 組織図上の部署ノード。 */
export const orgDepartments = sqliteTable("org_departments", {
  code: text("code").primaryKey(),
  departmentId: integer("department_id").notNull(),
  parentCode: text("parent_code"),
  managerEmployeeCode: text("manager_employee_code"),
  sortOrder: integer("sort_order").notNull(),
  archivedAt: integer("archived_at"),
  archivedByAccountId: text("archived_by_account_id").$type<AccountId>(),
})

export type OrgDepartmentRow = InferSelectModel<typeof orgDepartments>

/** 部署への所属。 */
export const orgMemberships = sqliteTable(
  "org_memberships",
  {
    departmentCode: text("department_code").notNull(),
    employeeCode: text("employee_code").notNull(),
    managerEmployeeCode: text("manager_employee_code"),
  },
  (table) => [primaryKey({ columns: [table.departmentCode, table.employeeCode] })],
)

export type OrgMembershipRow = InferSelectModel<typeof orgMemberships>

/** 一つの原子的な組織変更。expected revision競合と部分適用をDB境界で拒否する。 */
export const organizationChangeOperations = sqliteTable(
  "organization_change_operations",
  {
    id: text("id").primaryKey(),
    expectedRevision: integer("expected_revision").notNull(),
    changeCount: integer("change_count").notNull(),
    appliedCount: integer("applied_count").notNull().default(0),
    resultingRevision: integer("resulting_revision").notNull(),
    status: text("status", { enum: ["PENDING", "COMPLETED"] })
      .notNull()
      .default("PENDING"),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
    actorAccountId: text("actor_account_id").notNull().default("system:initialization"),
    reason: text("reason").notNull().default("initial organization change"),
    evidenceReferencesJson: text("evidence_references_json").notNull().default("[]"),
    requestFingerprint: text("request_fingerprint")
      .notNull()
      .default("0000000000000000000000000000000000000000000000000000000000000000"),
  },
  (table) => [
    check("organization_change_operations_id", sql`length(${table.id}) BETWEEN 1 AND 128`),
    check("organization_change_operations_expected", sql`${table.expectedRevision} >= 0`),
    check("organization_change_operations_count", sql`${table.changeCount} >= 1`),
    check(
      "organization_change_operations_applied",
      sql`${table.appliedCount} BETWEEN 0 AND ${table.changeCount}`,
    ),
    check(
      "organization_change_operations_result",
      sql`${table.resultingRevision} = ${table.expectedRevision} + ${table.changeCount}`,
    ),
    check(
      "organization_change_operations_status",
      sql`${table.status} IN ('PENDING', 'COMPLETED')`,
    ),
    check("organization_change_operations_recorded", sql`${table.recordedAt} >= 0`),
    check(
      "organization_change_operations_actor",
      sql`length(${table.actorAccountId}) BETWEEN 1 AND 255 AND trim(${table.actorAccountId}) = ${table.actorAccountId}`,
    ),
    check(
      "organization_change_operations_reason",
      sql`length(${table.reason}) BETWEEN 1 AND 1000 AND trim(${table.reason}) = ${table.reason}`,
    ),
    check(
      "organization_change_operations_evidence",
      sql`json_valid(${table.evidenceReferencesJson}) AND json_type(${table.evidenceReferencesJson}) = 'array'`,
    ),
    check(
      "organization_change_operations_fingerprint",
      sql`length(${table.requestFingerprint}) = 64
          AND ${table.requestFingerprint} NOT GLOB '*[^0-9a-f]*'`,
    ),
  ],
)

export type OrganizationChangeOperationRow = InferSelectModel<typeof organizationChangeOperations>

/** Company組織単位の安定identity。名称・code・親子関係は期間version側が所有する。 */
export const organizationUnits = sqliteTable(
  "organization_units",
  {
    id: text("id").primaryKey(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check("organization_units_id_length", sql`length(${table.id}) BETWEEN 1 AND 128`),
    check("organization_units_created_at", sql`${table.createdAt} >= 0`),
  ],
)

export type OrganizationUnitRow = InferSelectModel<typeof organizationUnits>

/** OrgUnitの有効期間付き属性。既存revisionは更新・削除せず、訂正を追記する。 */
export const organizationUnitPeriodVersions = sqliteTable(
  "organization_unit_period_versions",
  {
    periodId: text("period_id").notNull(),
    revision: integer("revision").notNull(),
    organizationUnitId: text("organization_unit_id")
      .notNull()
      .references(() => organizationUnits.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    officialName: text("official_name").notNull(),
    kind: text("kind", { enum: organizationUnitKinds }).notNull(),
    parentOrganizationUnitId: text("parent_organization_unit_id").references(
      (): typeof organizationUnits.id => organizationUnits.id,
      { onDelete: "restrict" },
    ),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    isVoid: integer("is_void", { mode: "boolean" }).notNull().default(false),
    recordedByActionId: text("recorded_by_action_id")
      .notNull()
      .references(() => organizationChangeOperations.id, { onDelete: "restrict" }),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.periodId, table.revision] }),
    index("organization_unit_period_versions_unit_idx").on(
      table.organizationUnitId,
      table.startsOn,
      table.endsOn,
      table.periodId,
      table.revision,
    ),
    index("organization_unit_period_versions_code_idx").on(
      table.code,
      table.startsOn,
      table.endsOn,
      table.periodId,
      table.revision,
    ),
    index("organization_unit_period_versions_parent_idx").on(
      table.parentOrganizationUnitId,
      table.startsOn,
      table.endsOn,
    ),
    check("organization_unit_period_versions_revision", sql`${table.revision} >= 1`),
    check(
      "organization_unit_period_versions_code",
      sql`length(${table.code}) BETWEEN 1 AND 64 AND trim(${table.code}) = ${table.code}`,
    ),
    check(
      "organization_unit_period_versions_name",
      sql`length(${table.officialName}) BETWEEN 1 AND 200
          AND trim(${table.officialName}) = ${table.officialName}`,
    ),
    check(
      "organization_unit_period_versions_kind",
      sql`${table.kind} IN ('COMPANY', 'DIVISION', 'DEPARTMENT', 'TEAM', 'OTHER')`,
    ),
    check(
      "organization_unit_period_versions_parent",
      sql`${table.parentOrganizationUnitId} IS NULL
          OR ${table.parentOrganizationUnitId} != ${table.organizationUnitId}`,
    ),
    check(
      "organization_unit_period_versions_range",
      sql`length(${table.startsOn}) = 10
          AND date(${table.startsOn}) IS ${table.startsOn}
          AND (
            ${table.endsOn} IS NULL OR (
              length(${table.endsOn}) = 10
              AND date(${table.endsOn}) IS ${table.endsOn}
              AND ${table.startsOn} < ${table.endsOn}
            )
          )`,
    ),
    check("organization_unit_period_versions_recorded_at", sql`${table.recordedAt} >= 0`),
  ],
)

export type OrganizationUnitPeriodVersionRow = InferSelectModel<
  typeof organizationUnitPeriodVersions
>

/** EmploymentとOrgUnitの主務・兼務所属。旧部署projectionから独立した正本。 */
export const organizationAssignmentPeriodVersions = sqliteTable(
  "organization_assignment_period_versions",
  {
    periodId: text("period_id").notNull(),
    revision: integer("revision").notNull(),
    employmentId: text("employment_id").notNull(),
    employeeId: text("employee_id").notNull(),
    organizationUnitId: text("organization_unit_id")
      .notNull()
      .references(() => organizationUnits.id, { onDelete: "restrict" }),
    assignmentType: text("assignment_type", { enum: orgAssignmentTypes }).notNull(),
    positionTitle: text("position_title"),
    managerEmployeeId: text("manager_employee_id"),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    isVoid: integer("is_void", { mode: "boolean" }).notNull().default(false),
    recordedByActionId: text("recorded_by_action_id")
      .notNull()
      .references(() => organizationChangeOperations.id, { onDelete: "restrict" }),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.periodId, table.revision] }),
    index("organization_assignment_period_versions_employee_idx").on(
      table.employeeId,
      table.startsOn,
      table.endsOn,
      table.assignmentType,
      table.periodId,
      table.revision,
    ),
    index("organization_assignment_period_versions_unit_idx").on(
      table.organizationUnitId,
      table.startsOn,
      table.endsOn,
      table.periodId,
      table.revision,
    ),
    check("organization_assignment_period_versions_revision", sql`${table.revision} >= 1`),
    check(
      "organization_assignment_period_versions_type",
      sql`${table.assignmentType} IN ('PRIMARY', 'CONCURRENT')`,
    ),
    check(
      "organization_assignment_period_versions_position",
      sql`${table.positionTitle} IS NULL OR (
        length(${table.positionTitle}) BETWEEN 1 AND 200
        AND trim(${table.positionTitle}) = ${table.positionTitle}
      )`,
    ),
    check(
      "organization_assignment_period_versions_manager",
      sql`${table.managerEmployeeId} IS NULL OR ${table.managerEmployeeId} != ${table.employeeId}`,
    ),
    check(
      "organization_assignment_period_versions_range",
      sql`length(${table.startsOn}) = 10
          AND date(${table.startsOn}) IS ${table.startsOn}
          AND (
            ${table.endsOn} IS NULL OR (
              length(${table.endsOn}) = 10
              AND date(${table.endsOn}) IS ${table.endsOn}
              AND ${table.startsOn} < ${table.endsOn}
            )
          )`,
    ),
    check("organization_assignment_period_versions_recorded", sql`${table.recordedAt} >= 0`),
  ],
)

export type OrganizationAssignmentPeriodVersionRow = InferSelectModel<
  typeof organizationAssignmentPeriodVersions
>

/** 所属とは独立した期間付き責務。保持者は同じOrgUnitへの所属を別途必要とする。 */
export const organizationResponsibilityPeriodVersions = sqliteTable(
  "organization_responsibility_period_versions",
  {
    periodId: text("period_id").notNull(),
    revision: integer("revision").notNull(),
    employmentId: text("employment_id").notNull(),
    employeeId: text("employee_id").notNull(),
    organizationUnitId: text("organization_unit_id")
      .notNull()
      .references(() => organizationUnits.id, { onDelete: "restrict" }),
    responsibilityType: text("responsibility_type").notNull(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    isVoid: integer("is_void", { mode: "boolean" }).notNull().default(false),
    recordedByActionId: text("recorded_by_action_id")
      .notNull()
      .references(() => organizationChangeOperations.id, { onDelete: "restrict" }),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.periodId, table.revision] }),
    index("organization_responsibility_period_versions_employee_idx").on(
      table.employeeId,
      table.startsOn,
      table.endsOn,
      table.periodId,
      table.revision,
    ),
    index("organization_responsibility_period_versions_unit_idx").on(
      table.organizationUnitId,
      table.responsibilityType,
      table.startsOn,
      table.endsOn,
      table.periodId,
      table.revision,
    ),
    check("organization_responsibility_period_versions_revision", sql`${table.revision} >= 1`),
    check(
      "organization_responsibility_period_versions_type",
      sql`length(${table.responsibilityType}) BETWEEN 1 AND 64
          AND ${table.responsibilityType} GLOB '[A-Z]*'
          AND ${table.responsibilityType} NOT GLOB '*[^A-Z0-9_]*'`,
    ),
    check(
      "organization_responsibility_period_versions_range",
      sql`length(${table.startsOn}) = 10
          AND date(${table.startsOn}) IS ${table.startsOn}
          AND (
            ${table.endsOn} IS NULL OR (
              length(${table.endsOn}) = 10
              AND date(${table.endsOn}) IS ${table.endsOn}
              AND ${table.startsOn} < ${table.endsOn}
            )
          )`,
    ),
    check("organization_responsibility_period_versions_recorded", sql`${table.recordedAt} >= 0`),
  ],
)

export type OrganizationResponsibilityPeriodVersionRow = InferSelectModel<
  typeof organizationResponsibilityPeriodVersions
>

/** Company組織のrevision。旧lifecycle schemaの物理tableを共通名で公開する。 */
export const organizationLifecycleStates = organizationLifecycleState
