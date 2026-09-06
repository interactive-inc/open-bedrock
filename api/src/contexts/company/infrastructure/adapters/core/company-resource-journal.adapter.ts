import type { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { compareCompanyResourcePersistence } from "@/contexts/company/domain/definitions/compare-company-resource-persistence.definition"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

import { and, eq, sql } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import type { BatchItem } from "drizzle-orm/batch"
import {
  companyOrganizations,
  companyCommandReceipts,
  companyResourceRevisions,
  companyResourceHeads,
} from "@/contexts/company/infrastructure/schema/company"

type Context = Readonly<{
  database: Pick<DrizzleD1Database, "insert" | "update">
  d1?: D1Database
}>
export type CompanyResourceJournalStatement = BatchItem<"sqlite"> & {
  toSQL(): { sql: string; params: unknown[] }
}
export type PreparedCompanyResourceJournal = Readonly<{
  fingerprint: string
  statements: ReadonlyArray<D1PreparedStatement>
  commit: D1PreparedStatement
}>

/** 公開writeと人事発令で共有する、版・履歴・再送記録のtransaction部品。 */
export class CompanyResourceJournalAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    change: CompanyResourceChangeEntity,
  ): Promise<PreparedCompanyResourceJournal | Error> {
    const d1 = this.c.d1
    if (d1 === undefined) return new Error("D1 statement preparation is unavailable")
    const journal = await this.build(change)
    if (journal instanceof Error) return journal
    const prepare = (statement: CompanyResourceJournalStatement) => {
      const query = statement.toSQL()
      return d1.prepare(query.sql).bind(...query.params)
    }
    return {
      fingerprint: journal.fingerprint,
      statements: journal.statements.map(prepare),
      commit: prepare(journal.commit),
    }
  }

  async build(change: CompanyResourceChangeEntity) {
    const database = this.c.database
    const organizationId = change.resources[0]?.organizationId
    if (organizationId === undefined) return new Error("empty Company command")
    const canonical = CanonicalSystemJsonValue.create({
      expectedRevision: change.expectedRevision,
      actorAccountId: change.actorAccountId,
      reason: change.reason,
      resources: change.resources.map((resource) => ({
        organizationId: resource.organizationId,
        type: resource.type,
        id: resource.id,
        revision: resource.revision,
        state: resource.state,
        effectiveFrom: resource.effectiveFrom,
        effectiveTo: resource.effectiveTo,
        attributes: resource.attributes,
      })),
    })
    if (canonical instanceof Error) return canonical
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) return digest
    const commandFingerprint = digest.toString()
    const organizationRevision = change.expectedRevision + 1
    const statements: CompanyResourceJournalStatement[] = []
    if (change.expectedRevision === 0) {
      statements.push(
        database.insert(companyOrganizations).select(sql`
          SELECT ${organizationId}, 0, '', '', ${change.recordedAt}, ${change.recordedAt}
          WHERE NOT EXISTS (SELECT 1 FROM company_organizations WHERE id = ${organizationId})
        `),
      )
    }
    statements.push(
      database.insert(companyCommandReceipts).values({
        organizationId,
        commandId: change.commandId,
        fingerprint: commandFingerprint,
        expectedRevision: change.expectedRevision,
        organizationRevision,
        recordedAt: change.recordedAt,
      }),
    )

    for (const resource of change.resources.toSorted(compareCompanyResourcePersistence)) {
      const attributesJson = CanonicalSystemJsonValue.create(resource.attributes)
      if (attributesJson instanceof Error) return attributesJson
      const values = {
        organizationId: resource.organizationId,
        resourceType: resource.type,
        resourceId: resource.id,
        revision: resource.revision,
        organizationRevision,
        state: resource.state,
        effectiveFrom: resource.effectiveFrom,
        effectiveTo: resource.effectiveTo,
        attributesJson: attributesJson.toString(),
      }
      statements.push(
        database.insert(companyResourceRevisions).values({
          ...values,
          commandId: change.commandId,
          actorAccountId: change.actorAccountId,
          reason: change.reason,
          recordedAt: change.recordedAt,
        }),
        database
          .insert(companyResourceHeads)
          .values({ ...values, updatedAt: change.recordedAt })
          .onConflictDoUpdate({
            target: [
              companyResourceHeads.organizationId,
              companyResourceHeads.resourceType,
              companyResourceHeads.resourceId,
            ],
            set: {
              revision: sql`excluded.revision`,
              organizationRevision: sql`excluded.organization_revision`,
              state: sql`excluded.state`,
              effectiveFrom: sql`excluded.effective_from`,
              effectiveTo: sql`excluded.effective_to`,
              attributesJson: sql`excluded.attributes_json`,
              updatedAt: sql`excluded.updated_at`,
            },
          }),
      )
    }

    return {
      fingerprint: commandFingerprint,
      statements,
      commit: database
        .update(companyOrganizations)
        .set({
          revision: organizationRevision,
          updatedAt: change.recordedAt,
        })
        .where(
          and(
            eq(companyOrganizations.id, organizationId),
            eq(companyOrganizations.revision, change.expectedRevision),
          ),
        ),
    }
  }
}
