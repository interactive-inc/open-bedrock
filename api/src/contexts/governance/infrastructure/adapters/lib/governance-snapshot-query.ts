import {
  decodeGovernanceRecordId,
  type GovernanceRecordKind,
} from "@/contexts/governance/domain/definitions/governance-record-kind.definition"

type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string>; formatVersion: 1 | 2 }>

export const governanceSourceTables = {
  "governance-acknowledgement-record": {
    table: "governance_acknowledgements",
    keys: ["version_id", "employee_id"],
    formatVersion: 2,
    columns: ["id", "version_id", "employee_id", "content_hash", "acknowledged_at"],
  },
  "governance-capability-record": {
    table: "governance_capabilities",
    keys: ["code"],
    formatVersion: 2,
    columns: [
      "id",
      "code",
      "name",
      "description",
      "owner_org_role_code",
      "status",
      "created_at",
      "updated_at",
    ],
  },
  "governance-document-reference-record": {
    table: "governance_document_references",
    keys: ["version_id", "kind", "code"],
    formatVersion: 2,
    columns: ["id", "version_id", "kind", "code"],
  },
  "governance-document-version-record": {
    table: "governance_document_versions",
    keys: ["id"],
    formatVersion: 1,
    columns: [
      "id",
      "document_id",
      "version",
      "body_md",
      "metadata_json",
      "procedure_json",
      "content_hash",
      "effective_from",
      "effective_to",
      "review_due_on",
      "state",
      "created_by_account_id",
      "created_at",
      "published_by_account_id",
      "published_at",
    ],
  },
  "governance-document-record": {
    table: "governance_documents",
    keys: ["id"],
    formatVersion: 1,
    columns: [
      "id",
      "code",
      "title",
      "kind",
      "classification",
      "owner_capability_code",
      "steward_org_role_code",
      "status",
      "current_version_id",
      "source_path",
      "created_by_account_id",
      "created_at",
      "updated_at",
    ],
  },
  "governance-org-role-assignment-record": {
    table: "governance_org_role_assignments",
    keys: ["id"],
    formatVersion: 2,
    columns: [
      "id",
      "legacy_id",
      "org_role_code",
      "employee_id",
      "department_code",
      "starts_on",
      "ends_on",
      "source_document_code",
      "created_by_account_id",
      "created_at",
      "revoked_by_account_id",
      "revoked_at",
    ],
  },
  "governance-org-role-record": {
    table: "governance_org_roles",
    keys: ["code"],
    formatVersion: 2,
    columns: [
      "id",
      "code",
      "name",
      "description",
      "assignment_mode",
      "cardinality",
      "created_at",
      "updated_at",
    ],
  },
  "governance-publication-approval-record": {
    table: "governance_publication_approvals",
    keys: ["version_id", "org_role_code"],
    formatVersion: 2,
    columns: [
      "id",
      "version_id",
      "org_role_code",
      "status",
      "decided_by_employee_id",
      "decided_at",
      "comment",
    ],
  },
} as const satisfies Record<
  GovernanceRecordKind,
  {
    table: string
    keys: ReadonlyArray<string>
    /** 版 2 は主キーを UUID へ移した後の本文で、代理の id または旧主キー（legacy_id）を含む。 */
    formatVersion: 1 | 2
    columns: ReadonlyArray<string>
  }
>

/** 規程・ガバナンス8台帳の現行全列を、元にない版を創作せず形式付きの原文にする。 */
export function governanceSnapshotQuery(
  recordKind: GovernanceRecordKind,
  recordId: string,
): SnapshotQuery | Error {
  const source = governanceSourceTables[recordKind]
  const parts = decodeGovernanceRecordId(recordId, source.keys.length)
  if (parts === null) return new Error("invalid governance record id")
  const fields = source.columns.map((column) => `'${column}',${column}`).join(",")
  const where = source.keys.map((column, index) => `${column}=?${index + 1}`).join(" AND ")
  return {
    sql: `SELECT json_object('format','${recordKind}','version',${source.formatVersion},'source',json_object(${fields})) AS snapshot_json FROM ${source.table} WHERE ${where}`,
    values: parts,
    formatVersion: source.formatVersion,
  }
}
