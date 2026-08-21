import type { Session } from "@/lib/auth/session"
import {
  parseGovernanceMarkdown,
  type GovernanceReference,
  type ParsedGovernanceMarkdown,
} from "@/contexts/governance/domain/definitions/governance-document.definition"
import { toSha256Hex } from "@/lib/crypto/to-sha256-hex"
import type { Context } from "@/env"
import type { GovernanceDocumentRecord } from "@/contexts/governance/infrastructure/governance.repository"
import { GovernanceRepository } from "@/contexts/governance/infrastructure/governance.repository"
import {
  ConflictError,
  ForbiddenError,
  UnprocessableError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"
import {
  governanceCapabilities,
  governanceDocuments,
  governanceOrgRoles,
} from "@/contexts/governance/infrastructure/schema/governance"

export type GovernanceMarkdownInput = {
  sourcePath: string
  markdown: string
  expectedContentHash?: string | null
}

export type GovernanceSyncResult = {
  code: string
  version: string
  content_hash: string
  outcome: "created" | "updated" | "unchanged"
}

export type GovernanceReferenceCatalog = Partial<
  Readonly<Record<GovernanceReference["kind"], ReadonlySet<string>>>
>

type PreparedDocument = {
  input: GovernanceMarkdownInput
  parsed: ParsedGovernanceMarkdown
  contentHash: string
  existing: GovernanceDocumentRecord | null
}

export class SyncGovernanceMarkdown {
  constructor(
    private readonly c: Context,
    private readonly permissionKeys: ReadonlyArray<string>,
    private readonly prepareAudit: (props: {
      session: Session
      action: "governance.document.synced"
      targetType: "governance_document"
      targetId: string
      metadata: Readonly<Record<string, string>>
    }) => readonly [D1PreparedStatement, D1PreparedStatement],
  ) {}

  async run(props: {
    session: Session
    documents: ReadonlyArray<GovernanceMarkdownInput>
    referenceCatalog?: GovernanceReferenceCatalog
  }): Promise<ReadonlyArray<GovernanceSyncResult> | Error> {
    if (!props.session.permissions.has("governance:manage")) {
      return new ForbiddenError("規程原本を同期する権限がありません", "governance_sync_forbidden")
    }
    if (props.documents.length === 0 || props.documents.length > 100) {
      return new ValidationError(
        "同期対象は1件以上100件以下にしてください",
        "governance_sync_count",
      )
    }

    const parsed = await Promise.all(
      props.documents.map(async (input) => {
        const sourceError = validateSourcePath(input.sourcePath)
        if (sourceError !== null) return sourceError
        const document = parseGovernanceMarkdown(input.markdown)
        if (document instanceof Error) {
          return new ValidationError(
            `${input.sourcePath}: ${document.message}`,
            "governance_markdown_invalid",
            { cause: document },
          )
        }
        return { input, parsed: document, contentHash: await toSha256Hex(input.markdown) }
      }),
    )
    const parseError = parsed.find((item) => item instanceof Error)
    if (parseError instanceof Error) return parseError
    const candidates = parsed.filter(
      (
        item,
      ): item is {
        input: GovernanceMarkdownInput
        parsed: ParsedGovernanceMarkdown
        contentHash: string
      } => !(item instanceof Error),
    )
    const duplicateError = findDuplicate(
      candidates.map((candidate) => candidate.parsed.metadata.id),
    )
    if (duplicateError !== null) {
      return new ConflictError(
        `同じ文書IDが複数指定されています: ${duplicateError}`,
        "governance_duplicate_document",
      )
    }
    const sourceDuplicate = findDuplicate(candidates.map((candidate) => candidate.input.sourcePath))
    if (sourceDuplicate !== null) {
      return new ConflictError(
        `同じ原本パスが複数指定されています: ${sourceDuplicate}`,
        "governance_duplicate_source",
      )
    }

    const repository = new GovernanceRepository(this.c)
    const prepared: Array<PreparedDocument> = []
    for (const candidate of candidates) {
      const [existingDocument, sourceOwner] = await Promise.all([
        repository.findVisibleRecord({ code: candidate.parsed.metadata.id, includeDraft: true }),
        repository.findDocumentBySourcePath(candidate.input.sourcePath),
      ])
      if (existingDocument instanceof Error || sourceOwner instanceof Error) {
        return new UnexpectedError("規程の既存状態を確認できません", {
          cause: existingDocument instanceof Error ? existingDocument : sourceOwner,
        })
      }
      if (sourceOwner !== null && sourceOwner.code !== candidate.parsed.metadata.id) {
        return new ConflictError(
          `${candidate.input.sourcePath} は別の文書IDで使用されています`,
          "governance_source_owned",
        )
      }
      prepared.push({ ...candidate, existing: existingDocument })
    }

    const referenceError = await this.validateReferences(prepared, props.referenceCatalog ?? {})
    if (referenceError !== null) return referenceError

    const now = this.c.env.NOW ?? new Date().toISOString()
    const results: Array<GovernanceSyncResult> = []
    for (const candidate of prepared) {
      const document = candidate.existing?.row ?? null
      const existingVersion =
        document === null
          ? null
          : await repository.findVersion(document.id, candidate.parsed.metadata.version)
      if (existingVersion instanceof Error) {
        return new UnexpectedError("規程版を確認できません", { cause: existingVersion })
      }
      if (existingVersion !== null) {
        if (
          candidate.input.expectedContentHash !== undefined &&
          candidate.input.expectedContentHash !== null
        ) {
          if (candidate.input.expectedContentHash !== existingVersion.row.contentHash) {
            return new ConflictError(
              `${candidate.parsed.metadata.id}@${candidate.parsed.metadata.version} は他で更新されています`,
              "governance_content_conflict",
            )
          }
        }
        if (existingVersion.row.contentHash === candidate.contentHash) {
          results.push({
            code: candidate.parsed.metadata.id,
            version: candidate.parsed.metadata.version,
            content_hash: candidate.contentHash,
            outcome: "unchanged",
          })
          continue
        }
        if (
          existingVersion.row.state === "published" ||
          existingVersion.row.state === "superseded"
        ) {
          return new ConflictError(
            `${candidate.parsed.metadata.id}@${candidate.parsed.metadata.version} は公開済みです。版を上げてください`,
            "governance_published_immutable",
          )
        }
        if (existingVersion.row.state === "in_review") {
          return new ConflictError(
            `${candidate.parsed.metadata.id}@${candidate.parsed.metadata.version} は審査中です`,
            "governance_review_locked",
          )
        }
      }

      const saved = await repository.upsertDraft({
        documentId: document?.id ?? crypto.randomUUID(),
        versionId: existingVersion?.row.id ?? crypto.randomUUID(),
        sourcePath: candidate.input.sourcePath,
        metadata: candidate.parsed.metadata,
        bodyMd: candidate.parsed.bodyMd,
        contentHash: candidate.contentHash,
        references: candidate.parsed.references,
        accountId: props.session.accountId,
        now,
        existingDocument: document,
        existingVersion,
        auditStatements: this.prepareAudit({
          session: props.session,
          action: "governance.document.synced",
          targetType: "governance_document",
          targetId: candidate.parsed.metadata.id,
          metadata: {
            version: candidate.parsed.metadata.version,
            source_path: candidate.input.sourcePath,
            content_hash: candidate.contentHash,
          },
        }),
      })
      if (saved instanceof Error) {
        return new UnexpectedError("規程の下書きを保存できません", { cause: saved })
      }
      results.push({
        code: candidate.parsed.metadata.id,
        version: candidate.parsed.metadata.version,
        content_hash: candidate.contentHash,
        outcome: existingVersion === null ? "created" : "updated",
      })
    }
    return results
  }

  private async validateReferences(
    documents: ReadonlyArray<PreparedDocument>,
    referenceCatalog: GovernanceReferenceCatalog,
  ): Promise<UnprocessableError | UnexpectedError | null> {
    try {
      const [capabilities, orgRoles, storedDocuments] = await Promise.all([
        this.c.var.database
          .select({ code: governanceCapabilities.code })
          .from(governanceCapabilities),
        this.c.var.database.select({ code: governanceOrgRoles.code }).from(governanceOrgRoles),
        this.c.var.database
          .select({ code: governanceDocuments.code, kind: governanceDocuments.kind })
          .from(governanceDocuments),
      ])
      const known = {
        capability: new Set(capabilities.map((item) => item.code)),
        org_role: new Set(orgRoles.map((item) => item.code)),
        permission: new Set(this.permissionKeys),
        training: referenceCatalog.training ?? new Set<string>(),
        policy: new Set(
          storedDocuments.filter((item) => item.kind === "policy").map((item) => item.code),
        ),
        procedure: new Set(
          storedDocuments.filter((item) => item.kind === "procedure").map((item) => item.code),
        ),
        guideline: new Set(
          storedDocuments.filter((item) => item.kind === "guideline").map((item) => item.code),
        ),
        control: new Set(
          storedDocuments.filter((item) => item.kind === "control").map((item) => item.code),
        ),
      }
      for (const document of documents) {
        known[document.parsed.metadata.kind].add(document.parsed.metadata.id)
      }
      const unresolved: Array<string> = []
      for (const document of documents) {
        for (const reference of document.parsed.references) {
          if (!hasReference(known, reference)) {
            unresolved.push(`${document.parsed.metadata.id} -> ${reference.kind}:${reference.code}`)
          }
        }
      }
      return unresolved.length === 0
        ? null
        : new UnprocessableError(
            `未解決の参照があります: ${unresolved.slice(0, 20).join(", ")}`,
            "governance_reference_unresolved",
          )
    } catch (error) {
      return new UnexpectedError("規程の参照整合性を確認できません", { cause: error })
    }
  }
}

function hasReference(
  known: Record<GovernanceReference["kind"], ReadonlySet<string>>,
  reference: GovernanceReference,
): boolean {
  return known[reference.kind].has(reference.code)
}

function validateSourcePath(value: string): ValidationError | null {
  if (
    value.length < 3 ||
    value.length > 500 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.split("/").includes("..") ||
    !value.endsWith(".md")
  ) {
    return new ValidationError(
      "source_path はリポジトリ内の相対Markdownパスにしてください",
      "governance_source_path_invalid",
    )
  }
  return null
}

function findDuplicate(values: ReadonlyArray<string>): string | null {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) return value
    seen.add(value)
  }
  return null
}
