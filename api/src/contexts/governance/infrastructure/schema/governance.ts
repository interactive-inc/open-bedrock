import type { InferSelectModel } from "drizzle-orm"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { sql } from "drizzle-orm"
import { check, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 規程・手続き・統制の安定した業務能力。表示名や担当組織の変更で code は変えない。 */
export const governanceCapabilities = sqliteTable("governance_capabilities", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ownerOrgRoleCode: text("owner_org_role_code"),
  status: text("status").notNull().$type<"active" | "archived">(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export type GovernanceCapabilityRow = InferSelectModel<typeof governanceCapabilities>

/** 組織上の責任。IAM の system role（操作能力）とは分離する。 */
export const governanceOrgRoles = sqliteTable("governance_org_roles", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  assignmentMode: text("assignment_mode").notNull().$type<"manual" | "department_manager">(),
  cardinality: text("cardinality").notNull().$type<"one" | "per_department" | "many">(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export type GovernanceOrgRoleRow = InferSelectModel<typeof governanceOrgRoles>

export const governanceOrgRoleAssignments = sqliteTable(
  "governance_org_role_assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orgRoleCode: text("org_role_code").notNull(),
    employeeId: integer("employee_id").notNull(),
    departmentCode: text("department_code"),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    sourceDocumentCode: text("source_document_code"),
    createdByAccountId: text("created_by_account_id").notNull().$type<AccountId>(),
    createdAt: text("created_at").notNull(),
    revokedByAccountId: text("revoked_by_account_id").$type<AccountId>(),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    check(
      "governance_org_role_assignments_range",
      sql`${table.endsOn} IS NULL OR ${table.startsOn} < ${table.endsOn}`,
    ),
  ],
)

export type GovernanceOrgRoleAssignmentRow = InferSelectModel<typeof governanceOrgRoleAssignments>

export const governanceDocuments = sqliteTable("governance_documents", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  kind: text("kind").notNull().$type<"policy" | "procedure" | "guideline" | "control">(),
  classification: text("classification")
    .notNull()
    .$type<"public" | "internal" | "confidential" | "restricted">(),
  ownerCapabilityCode: text("owner_capability_code").notNull(),
  stewardOrgRoleCode: text("steward_org_role_code"),
  status: text("status").notNull().$type<"draft" | "published" | "retired">(),
  currentVersionId: text("current_version_id"),
  sourcePath: text("source_path").notNull().unique(),
  createdByAccountId: text("created_by_account_id").notNull().$type<AccountId>(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export type GovernanceDocumentRow = InferSelectModel<typeof governanceDocuments>

export const governanceDocumentVersions = sqliteTable(
  "governance_document_versions",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id").notNull(),
    version: text("version").notNull(),
    bodyMd: text("body_md").notNull(),
    metadataJson: text("metadata_json").notNull(),
    procedureJson: text("procedure_json"),
    contentHash: text("content_hash").notNull(),
    effectiveFrom: text("effective_from"),
    effectiveTo: text("effective_to"),
    reviewDueOn: text("review_due_on"),
    state: text("state")
      .notNull()
      .$type<"draft" | "in_review" | "published" | "superseded" | "rejected">(),
    createdByAccountId: text("created_by_account_id").notNull().$type<AccountId>(),
    createdAt: text("created_at").notNull(),
    publishedByAccountId: text("published_by_account_id").$type<AccountId>(),
    publishedAt: text("published_at"),
  },
  (table) => [
    uniqueIndex("uniq_governance_document_version").on(table.documentId, table.version),
    check(
      "governance_document_versions_range",
      sql`${table.effectiveTo} IS NULL OR ${table.effectiveFrom} IS NULL OR ${table.effectiveFrom} < ${table.effectiveTo}`,
    ),
  ],
)

export type GovernanceDocumentVersionRow = InferSelectModel<typeof governanceDocumentVersions>

export const governanceDocumentReferences = sqliteTable(
  "governance_document_references",
  {
    versionId: text("version_id").notNull(),
    kind: text("kind")
      .notNull()
      .$type<
        | "capability"
        | "org_role"
        | "policy"
        | "procedure"
        | "guideline"
        | "control"
        | "permission"
        | "training"
      >(),
    code: text("code").notNull(),
  },
  (table) => [primaryKey({ columns: [table.versionId, table.kind, table.code] })],
)

export type GovernanceDocumentReferenceRow = InferSelectModel<typeof governanceDocumentReferences>

export const governancePublicationApprovals = sqliteTable(
  "governance_publication_approvals",
  {
    versionId: text("version_id").notNull(),
    orgRoleCode: text("org_role_code").notNull(),
    status: text("status").notNull().$type<"pending" | "approved" | "rejected">(),
    decidedByEmployeeId: integer("decided_by_employee_id"),
    decidedAt: text("decided_at"),
    comment: text("comment"),
  },
  (table) => [primaryKey({ columns: [table.versionId, table.orgRoleCode] })],
)

export type GovernancePublicationApprovalRow = InferSelectModel<
  typeof governancePublicationApprovals
>

export const governanceAcknowledgements = sqliteTable(
  "governance_acknowledgements",
  {
    versionId: text("version_id").notNull(),
    employeeId: integer("employee_id").notNull(),
    contentHash: text("content_hash").notNull(),
    acknowledgedAt: text("acknowledged_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.versionId, table.employeeId] })],
)

export type GovernanceAcknowledgementRow = InferSelectModel<typeof governanceAcknowledgements>
