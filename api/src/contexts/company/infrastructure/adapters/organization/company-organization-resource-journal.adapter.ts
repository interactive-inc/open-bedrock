import type { OrganizationWorkforceChangeEntity } from "@/contexts/company/domain/entities/organization-workforce-change.entity"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import {
  CompanyUnavailableError,
  CompanyValidationError,
  type CompanyOperationError,
} from "@/contexts/company/domain/errors"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import { validateCompanyOrganizationChange } from "@/contexts/company/domain/policies/company-organization.policy"
import { drizzle } from "drizzle-orm/d1"
type Context = D1Database

/** 接続済みの組織への既存writeを公開履歴へ反映し、新設組織は接続済みの親から引き継ぐ。 */
export class CompanyOrganizationResourceJournalAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async prepare(
    change: OrganizationWorkforceChangeEntity,
  ): Promise<ReadonlyArray<D1PreparedStatement> | CompanyOperationError> {
    if (change.unitPeriods.length === 0) return []
    try {
      const bindings = await this.c
        .prepare(
          "SELECT organization_unit_id FROM company_organization_resource_bindings WHERE organization_id = 'organization:default'",
        )
        .all<{ organization_unit_id: string }>()
      const connected = new Set(bindings.results.map((binding) => binding.organization_unit_id))
      if (connected.size === 0) return []
      const newIds = new Set(change.organizationUnits.map((unit) => unit.id))
      for (const parentId of connected) {
        for (const period of change.unitPeriods) {
          if (newIds.has(period.organizationUnitId) && period.parentOrganizationUnitId === parentId)
            connected.add(period.organizationUnitId)
        }
      }
      const periods = change.unitPeriods.filter((period) =>
        connected.has(period.organizationUnitId),
      )
      if (periods.length === 0) return []
      const repository = new D1CompanyResourceRepository(this.c)
      const current = await repository.findMany({
        organizationId: "organization:default",
        types: ["organization-unit"],
      })
      if (!current.ok)
        return new CompanyUnavailableError(
          "公開組織を参照できません",
          "organization_change_unavailable",
          { cause: current.cause },
        )
      const command = CompanyResourceChangeEntity.create({
        commandId: `legacy-org:${change.operationId}`,
        expectedRevision: current.organizationRevision,
        actorAccountId: change.actorAccountId,
        reason: change.reason,
        recordedAt: change.recordedAt,
        resources: periods.map((period) => ({
          organizationId: "organization:default",
          type: "organization-unit",
          id: period.periodId,
          revision: period.revision,
          state: period.isVoid ? "void" : "active",
          effectiveFrom: period.startsOn,
          effectiveTo: period.endsOn,
          attributes: {
            organizationUnitId: period.organizationUnitId,
            code: period.code,
            officialName: period.officialName,
            kind: period.kind,
            parentOrganizationUnitId: period.parentOrganizationUnitId,
          },
        })),
      })
      if (command instanceof Error)
        return new CompanyValidationError("公開組織の変更内容が不正です", "invalid_change", {
          cause: command,
        })
      const reportingHistory = await repository.findReportingRelationHistory(
        "organization:default",
        current.organizationRevision,
      )
      if (reportingHistory instanceof Error)
        return new CompanyUnavailableError(
          "指揮命令の履歴を参照できません",
          "organization_change_unavailable",
          { cause: reportingHistory },
        )
      const invalid = validateCompanyOrganizationChange(
        current.resources,
        command,
        reportingHistory,
      )
      if (invalid !== null)
        return new CompanyValidationError(
          "親組織の接続と公開組織の期間を確認してください",
          "invalid_change",
          { cause: invalid },
        )
      const journal = await new CompanyResourceJournalAdapter({
        database: drizzle(this.c),
        d1: this.c,
      }).prepare(command)
      if (journal instanceof Error)
        return new CompanyUnavailableError(
          "公開組織の変更を準備できません",
          "organization_change_unavailable",
          { cause: journal },
        )
      return [
        ...journal.statements,
        ...[...newIds]
          .filter((id) => connected.has(id))
          .map((id) =>
            this.c
              .prepare(`INSERT INTO company_organization_resource_bindings
        (organization_unit_id, organization_id, recorded_at) VALUES (?1, 'organization:default', ?2)`)
              .bind(id, change.recordedAt),
          ),
        journal.commit,
      ]
    } catch (cause) {
      return new CompanyUnavailableError(
        "公開組織の変更を準備できません",
        "organization_change_unavailable",
        { cause },
      )
    }
  }
}
