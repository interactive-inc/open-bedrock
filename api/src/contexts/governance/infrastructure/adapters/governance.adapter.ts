import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type {
  GovernanceMetadata,
  GovernanceReference,
} from "@/contexts/governance/domain/definitions/governance-document.definition"
import {
  zGovernanceMetadata,
  zProcedureDefinition,
} from "@/contexts/governance/domain/definitions/governance-document.definition"
import type { Context } from "@/env"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import {
  governanceAcknowledgements,
  governanceCapabilities,
  governanceDocuments,
  governanceDocumentReferences,
  governanceDocumentVersions,
  governancePublicationApprovals,
} from "@/contexts/governance/infrastructure/schema/governance"
import {
  findGovernanceOrgRole,
  governanceOrgRoles,
} from "@/contexts/governance/domain/catalogs/governance-org-role.catalog"
import { and, asc, desc, eq } from "drizzle-orm"

export type GovernanceVersionRecord = {
  row: typeof governanceDocumentVersions.$inferSelect
  metadata: GovernanceMetadata
  references: ReadonlyArray<typeof governanceDocumentReferences.$inferSelect>
  approvals: ReadonlyArray<typeof governancePublicationApprovals.$inferSelect>
}

export type GovernanceDocumentRecord = {
  row: typeof governanceDocuments.$inferSelect
  version: GovernanceVersionRecord | null
}

export type GovernanceAuditStatements = ReadonlyArray<D1PreparedStatement>

export class GovernanceAdapter {
  constructor(private readonly c: Context) {}

  async findDocument(
    code: string,
  ): Promise<typeof governanceDocuments.$inferSelect | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(governanceDocuments)
        .where(eq(governanceDocuments.code, code))
        .limit(1)
      return rows.at(0) ?? null
    } catch (error) {
      return toError(error, "failed to load governance document")
    }
  }

  async findDocumentBySourcePath(
    sourcePath: string,
  ): Promise<typeof governanceDocuments.$inferSelect | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(governanceDocuments)
        .where(eq(governanceDocuments.sourcePath, sourcePath))
        .limit(1)
      return rows.at(0) ?? null
    } catch (error) {
      return toError(error, "failed to load governance source path")
    }
  }

  async findVersion(
    documentId: string,
    version: string,
  ): Promise<GovernanceVersionRecord | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(governanceDocumentVersions)
        .where(
          and(
            eq(governanceDocumentVersions.documentId, documentId),
            eq(governanceDocumentVersions.version, version),
          ),
        )
        .limit(1)
      const row = rows.at(0)
      return row === undefined ? null : await this.hydrateVersion(row)
    } catch (error) {
      return toError(error, "failed to load governance version")
    }
  }

  async findVersionById(versionId: string): Promise<GovernanceVersionRecord | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(governanceDocumentVersions)
        .where(eq(governanceDocumentVersions.id, versionId))
        .limit(1)
      const row = rows.at(0)
      return row === undefined ? null : await this.hydrateVersion(row)
    } catch (error) {
      return toError(error, "failed to load governance version")
    }
  }

  async findVisibleRecord(props: {
    code: string
    includeDraft: boolean
  }): Promise<GovernanceDocumentRecord | null | Error> {
    const document = await this.findDocument(props.code)
    if (document === null || document instanceof Error) return document
    let version: GovernanceVersionRecord | null | Error = null
    if (props.includeDraft) {
      const rows = await this.c.var.database
        .select()
        .from(governanceDocumentVersions)
        .where(eq(governanceDocumentVersions.documentId, document.id))
        .orderBy(desc(governanceDocumentVersions.createdAt), desc(governanceDocumentVersions.id))
        .limit(1)
      version = rows[0] === undefined ? null : await this.hydrateVersion(rows[0])
    } else if (document.currentVersionId !== null) {
      version = await this.findVersionById(document.currentVersionId)
    }
    return version instanceof Error ? version : { row: document, version }
  }

  async listDocuments(
    includeDrafts: boolean,
  ): Promise<ReadonlyArray<GovernanceDocumentRecord> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(governanceDocuments)
        .where(includeDrafts ? undefined : eq(governanceDocuments.status, "published"))
        .orderBy(asc(governanceDocuments.kind), asc(governanceDocuments.title))
        .limit(500)
      const records = await Promise.all(
        rows.map((row) => this.findVisibleRecord({ code: row.code, includeDraft: includeDrafts })),
      )
      const error = records.find((record) => record instanceof Error)
      if (error instanceof Error) return error
      return records.filter(
        (record): record is GovernanceDocumentRecord =>
          record !== null && !(record instanceof Error),
      )
    } catch (error) {
      return toError(error, "failed to list governance documents")
    }
  }

  async listVersions(documentId: string): Promise<ReadonlyArray<GovernanceVersionRecord> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(governanceDocumentVersions)
        .where(eq(governanceDocumentVersions.documentId, documentId))
        .orderBy(desc(governanceDocumentVersions.createdAt), desc(governanceDocumentVersions.id))
      const versions = await Promise.all(rows.map((row) => this.hydrateVersion(row)))
      const error = versions.find((version) => version instanceof Error)
      if (error instanceof Error) return error
      return versions.filter(
        (version): version is GovernanceVersionRecord => !(version instanceof Error),
      )
    } catch (error) {
      return toError(error, "failed to list governance versions")
    }
  }

  async upsertDraft(props: {
    documentId: string
    versionId: string
    sourcePath: string
    metadata: GovernanceMetadata
    bodyMd: string
    contentHash: string
    references: ReadonlyArray<GovernanceReference>
    accountId: AccountId
    now: string
    existingDocument: typeof governanceDocuments.$inferSelect | null
    existingVersion: GovernanceVersionRecord | null
    auditStatements: ReadonlyArray<D1PreparedStatement>
  }): Promise<null | Error> {
    try {
      const procedureJson =
        props.metadata.procedure === null ? null : JSON.stringify(props.metadata.procedure)
      const documentStatement =
        props.existingDocument === null
          ? this.c.env.DB.prepare(
              `INSERT INTO governance_documents
                (id, code, title, kind, classification, owner_capability_code,
                 steward_org_role_code, status, current_version_id, source_path,
                 created_by_account_id, created_at, updated_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'draft', NULL, ?8, ?9, ?10, ?10)`,
            ).bind(
              props.documentId,
              props.metadata.id,
              props.metadata.title,
              props.metadata.kind,
              props.metadata.classification,
              props.metadata.owner_capability,
              props.metadata.steward_org_role,
              props.sourcePath,
              props.accountId,
              props.now,
            )
          : props.existingDocument.status === "published"
            ? this.c.env.DB.prepare(
                `UPDATE governance_documents SET source_path = ?1, updated_at = ?2 WHERE id = ?3`,
              ).bind(props.sourcePath, props.now, props.documentId)
            : this.c.env.DB.prepare(
                `UPDATE governance_documents
                 SET title = ?1, kind = ?2, classification = ?3, owner_capability_code = ?4,
                     steward_org_role_code = ?5, source_path = ?6, updated_at = ?7
                 WHERE id = ?8`,
              ).bind(
                props.metadata.title,
                props.metadata.kind,
                props.metadata.classification,
                props.metadata.owner_capability,
                props.metadata.steward_org_role,
                props.sourcePath,
                props.now,
                props.documentId,
              )
      const versionStatement =
        props.existingVersion === null
          ? this.c.env.DB.prepare(
              `INSERT INTO governance_document_versions
                (id, document_id, version, body_md, metadata_json, procedure_json, content_hash,
                 effective_from, effective_to, review_due_on, state, created_by_account_id, created_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'draft', ?11, ?12)`,
            ).bind(
              props.versionId,
              props.documentId,
              props.metadata.version,
              props.bodyMd,
              JSON.stringify(props.metadata),
              procedureJson,
              props.contentHash,
              props.metadata.effective_from,
              props.metadata.effective_to,
              props.metadata.review_due_on,
              props.accountId,
              props.now,
            )
          : this.c.env.DB.prepare(
              `UPDATE governance_document_versions
               SET body_md = ?1, metadata_json = ?2, procedure_json = ?3, content_hash = ?4,
                   effective_from = ?5, effective_to = ?6, review_due_on = ?7,
                   state = 'draft', created_by_account_id = ?8, created_at = ?9,
                   published_by_account_id = NULL, published_at = NULL
               WHERE id = ?10 AND state IN ('draft', 'rejected')`,
            ).bind(
              props.bodyMd,
              JSON.stringify(props.metadata),
              procedureJson,
              props.contentHash,
              props.metadata.effective_from,
              props.metadata.effective_to,
              props.metadata.review_due_on,
              props.accountId,
              props.now,
              props.versionId,
            )
      const statements: Array<D1PreparedStatement> = [
        documentStatement,
        versionStatement,
        ...(props.existingVersion === null
          ? []
          : [abortWhenPreviousStatementChangedNoRows(this.c.env.DB)]),
        this.c.env.DB.prepare(
          "DELETE FROM governance_document_references WHERE version_id = ?1",
        ).bind(props.versionId),
        ...props.references.map((reference) =>
          this.c.env.DB.prepare(
            `INSERT INTO governance_document_references (version_id, kind, code)
             VALUES (?1, ?2, ?3)`,
          ).bind(props.versionId, reference.kind, reference.code),
        ),
        this.c.env.DB.prepare(
          "DELETE FROM governance_publication_approvals WHERE version_id = ?1",
        ).bind(props.versionId),
        ...props.auditStatements,
      ]
      await this.c.env.DB.batch(statements)
      return null
    } catch (error) {
      return toError(error, "failed to save governance draft")
    }
  }

  async submitForReview(props: {
    versionId: string
    approverOrgRoles: ReadonlyArray<string>
    auditStatements: ReadonlyArray<D1PreparedStatement>
  }): Promise<null | Error> {
    try {
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          "UPDATE governance_document_versions SET state = 'in_review' WHERE id = ?1 AND state = 'draft'",
        ).bind(props.versionId),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        ...props.approverOrgRoles.map((orgRoleCode) =>
          this.c.env.DB.prepare(
            `INSERT INTO governance_publication_approvals
              (version_id, org_role_code, status, decided_by_employee_id, decided_at, comment)
             VALUES (?1, ?2, 'pending', NULL, NULL, NULL)
             ON CONFLICT(version_id, org_role_code) DO UPDATE SET
               status = 'pending', decided_by_employee_id = NULL, decided_at = NULL, comment = NULL`,
          ).bind(props.versionId, orgRoleCode),
        ),
        ...props.auditStatements,
      ])
      return null
    } catch (error) {
      return toError(error, "failed to submit governance review")
    }
  }

  async decideReview(props: {
    versionId: string
    orgRoleCode: string
    decision: "approved" | "rejected"
    employeeId: EmployeeId
    decidedAt: string
    comment: string | null
    auditStatements: ReadonlyArray<D1PreparedStatement>
  }): Promise<boolean | Error> {
    try {
      const statements = [
        this.c.env.DB.prepare(
          `UPDATE governance_publication_approvals
           SET status = ?1, decided_by_employee_id = ?2, decided_at = ?3, comment = ?4
           WHERE version_id = ?5 AND org_role_code = ?6 AND status = 'pending'`,
        ).bind(
          props.decision,
          props.employeeId,
          props.decidedAt,
          props.comment,
          props.versionId,
          props.orgRoleCode,
        ),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        ...(props.decision === "rejected"
          ? [
              this.c.env.DB.prepare(
                "UPDATE governance_document_versions SET state = 'rejected' WHERE id = ?1",
              ).bind(props.versionId),
            ]
          : []),
        ...props.auditStatements,
      ]
      await this.c.env.DB.batch(statements)
      return true
    } catch (error) {
      if (isAbortedByGuard(error)) return false
      return toError(error, "failed to decide governance review")
    }
  }

  async publish(props: {
    document: typeof governanceDocuments.$inferSelect
    version: GovernanceVersionRecord
    accountId: AccountId
    now: string
    auditStatements: ReadonlyArray<D1PreparedStatement>
  }): Promise<null | Error> {
    try {
      const statements: Array<D1PreparedStatement> = []
      if (props.document.currentVersionId !== null) {
        statements.push(
          this.c.env.DB.prepare(
            `UPDATE governance_document_versions SET state = 'superseded'
             WHERE id = ?1 AND state = 'published'`,
          ).bind(props.document.currentVersionId),
        )
      }
      statements.push(
        this.c.env.DB.prepare(
          `UPDATE governance_document_versions
           SET state = 'published', published_by_account_id = ?1, published_at = ?2
           WHERE id = ?3 AND state IN ('draft', 'in_review')`,
        ).bind(props.accountId, props.now, props.version.row.id),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        this.c.env.DB.prepare(
          `UPDATE governance_documents
           SET title = ?1, kind = ?2, classification = ?3, owner_capability_code = ?4,
               steward_org_role_code = ?5, status = 'published', current_version_id = ?6,
               updated_at = ?7
           WHERE id = ?8`,
        ).bind(
          props.version.metadata.title,
          props.version.metadata.kind,
          props.version.metadata.classification,
          props.version.metadata.owner_capability,
          props.version.metadata.steward_org_role,
          props.version.row.id,
          props.now,
          props.document.id,
        ),
        ...props.auditStatements,
      )
      await this.c.env.DB.batch(statements)
      return null
    } catch (error) {
      return toError(error, "failed to publish governance version")
    }
  }

  async acknowledge(props: {
    versionId: string
    employeeId: EmployeeId
    contentHash: string
    acknowledgedAt: string
    auditStatements: ReadonlyArray<D1PreparedStatement>
  }): Promise<null | Error> {
    try {
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `INSERT INTO governance_acknowledgements
            (version_id, employee_id, content_hash, acknowledged_at)
           VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT(version_id, employee_id) DO UPDATE SET
             content_hash = excluded.content_hash, acknowledged_at = excluded.acknowledged_at`,
        ).bind(props.versionId, props.employeeId, props.contentHash, props.acknowledgedAt),
        ...props.auditStatements,
      ])
      return null
    } catch (error) {
      return toError(error, "failed to acknowledge governance version")
    }
  }

  async hasAcknowledged(versionId: string, employeeId: EmployeeId): Promise<boolean | Error> {
    try {
      const rows = await this.c.var.database
        .select({ versionId: governanceAcknowledgements.versionId })
        .from(governanceAcknowledgements)
        .where(
          and(
            eq(governanceAcknowledgements.versionId, versionId),
            eq(governanceAcknowledgements.employeeId, employeeId),
          ),
        )
        .limit(1)
      return rows.length > 0
    } catch (error) {
      return toError(error, "failed to load governance acknowledgement")
    }
  }

  async listCapabilities() {
    try {
      return await this.c.var.database
        .select()
        .from(governanceCapabilities)
        .orderBy(asc(governanceCapabilities.code))
    } catch (error) {
      return toError(error, "failed to list governance capabilities")
    }
  }

  async listOrgRoles() {
    return governanceOrgRoles
  }

  async findOrgRole(code: string) {
    return findGovernanceOrgRole(code)
  }

  private async hydrateVersion(
    row: typeof governanceDocumentVersions.$inferSelect,
  ): Promise<GovernanceVersionRecord | Error> {
    try {
      const metadata = zGovernanceMetadata.parse(JSON.parse(row.metadataJson))
      if (row.procedureJson !== null) zProcedureDefinition.parse(JSON.parse(row.procedureJson))
      const [references, approvals] = await Promise.all([
        this.c.var.database
          .select()
          .from(governanceDocumentReferences)
          .where(eq(governanceDocumentReferences.versionId, row.id))
          .orderBy(asc(governanceDocumentReferences.kind), asc(governanceDocumentReferences.code)),
        this.c.var.database
          .select()
          .from(governancePublicationApprovals)
          .where(eq(governancePublicationApprovals.versionId, row.id))
          .orderBy(asc(governancePublicationApprovals.orgRoleCode)),
      ])
      return { row, metadata, references, approvals }
    } catch (error) {
      return toError(error, "governance version is corrupted")
    }
  }
}

function toError(error: unknown, message: string): Error {
  return error instanceof Error ? error : new Error(message)
}
