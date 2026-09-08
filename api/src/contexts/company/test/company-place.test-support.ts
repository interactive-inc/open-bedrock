import { readFileSync } from "node:fs"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"

/** 法人・拠点・勤務場所と安定した組織IDを持つ、独立した会社台帳を作る。 */
export function createCompanyPlaceTestContext(schemaSql?: string) {
  const schema =
    schemaSql ??
    readFileSync(
      new URL("../../system/infrastructure/schema/system-core.sql", import.meta.url),
      "utf8",
    ) +
      "\n" +
      readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8")
  const database = createCompanyD1TestDatabase(schema)
  const repository = new D1CompanyResourceRepository(database)
  const common: Omit<CompanyResourceProps, "type" | "id" | "attributes"> = {
    organizationId: "organization:default",
    revision: 1,
    state: "active",
    effectiveFrom: restoreCalendarDate("2030-01-01"),
    effectiveTo: null,
  }
  const legalEntity: CompanyResourceProps = {
    ...common,
    type: "legal-entity",
    id: "legal:primary",
    attributes: {
      officialName: "Example Company",
      jurisdictionCountryCode: "JP",
      registrationNumber: null,
      defaultCurrencyCode: "JPY",
    },
  }
  const site: CompanyResourceProps = {
    ...common,
    type: "site",
    id: "site:office",
    attributes: {
      code: "OFFICE",
      officialName: "Office",
      legalEntityId: legalEntity.id,
      kind: "physical",
      timeZone: "UTC",
      countryCode: "JP",
    },
  }
  const unit: CompanyResourceProps = {
    ...common,
    type: "organization-unit",
    id: "period:root",
    attributes: {
      organizationUnitId: "unit:root",
      code: "ROOT",
      officialName: "Company",
      kind: "COMPANY",
      parentOrganizationUnitId: null,
    },
  }
  const workplace: CompanyResourceProps = {
    ...common,
    type: "workplace",
    id: "workplace:office",
    attributes: {
      code: "OFFICE",
      officialName: "Office",
      siteId: site.id,
      kind: "office",
      organizationUnitId: "unit:root",
    },
  }
  const resources = [legalEntity, site, unit, workplace]
  const write = async (props: {
    resources: ReadonlyArray<CompanyResourceProps>
    expectedRevision: number
    commandId?: string
  }) => {
    const command = CompanyResourceChangeEntity.create({
      ...props,
      commandId: props.commandId ?? `command:${props.expectedRevision}`,
      actorAccountId: "account:operator",
      reason: "Confirm place history",
      recordedAt: Date.parse("2030-06-01T00:00:00Z"),
    })
    if (command instanceof Error) throw command
    return repository.write(command)
  }
  const saved = async () => ({
    revisions: (
      await database
        .prepare(
          "SELECT * FROM company_resource_revisions ORDER BY organization_id, resource_type, resource_id, revision",
        )
        .all()
    ).results,
    heads: (
      await database
        .prepare(
          "SELECT * FROM company_resource_heads ORDER BY organization_id, resource_type, resource_id",
        )
        .all()
    ).results,
    organizations: (await database.prepare("SELECT * FROM company_organizations ORDER BY id").all())
      .results,
    receipts: (
      await database
        .prepare("SELECT * FROM company_command_receipts ORDER BY organization_id, command_id")
        .all()
    ).results,
  })
  return {
    database,
    repository,
    schema,
    common,
    legalEntity,
    site,
    unit,
    workplace,
    resources,
    write,
    saved,
  }
}
