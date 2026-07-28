import type { GovernanceDocumentRecord } from "@/infrastructure/governance/governance-repository"

/**
 * 規程ドキュメントレコードを API レスポンス形へ整形する。公開版が無ければ null。
 */
export function toGovernanceDocumentResponse(
  record: GovernanceDocumentRecord,
  options?: { acknowledged?: boolean; includeSource?: boolean },
) {
  const versionRecord = record.version
  if (versionRecord === null) return null
  return {
    code: record.row.code,
    title: versionRecord.metadata.title,
    kind: versionRecord.metadata.kind,
    classification: versionRecord.metadata.classification,
    owner_capability: versionRecord.metadata.owner_capability,
    steward_org_role: versionRecord.metadata.steward_org_role,
    status: record.row.status,
    source_path: options?.includeSource ? record.row.sourcePath : null,
    version: versionRecord.row.version,
    version_id: versionRecord.row.id,
    version_state: versionRecord.row.state,
    content_hash: versionRecord.row.contentHash,
    effective_from: versionRecord.row.effectiveFrom,
    effective_to: versionRecord.row.effectiveTo,
    review_due_on: versionRecord.row.reviewDueOn,
    published_at: versionRecord.row.publishedAt,
    body_md: versionRecord.row.bodyMd,
    metadata: versionRecord.metadata,
    references: versionRecord.references.map((reference) => ({
      kind: reference.kind,
      code: reference.code,
    })),
    approvals: versionRecord.approvals.map((approval) => ({
      org_role_code: approval.orgRoleCode,
      status: approval.status,
      decided_by_employee_id: approval.decidedByEmployeeId,
      decided_at: approval.decidedAt,
      comment: approval.comment,
    })),
    acknowledged: options?.acknowledged ?? false,
  }
}
