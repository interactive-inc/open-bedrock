import { readFileSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"

const validationMigration = "0154_validate_existing_company_account_links.sql"
const bindingMigration = "0147_bind_company_account_employee_resources.sql"
const countsSchema = z
  .object({
    unconnected_resource_links: z.number().int().nonnegative().safe(),
    unconnected_bound_links: z.number().int().nonnegative().safe(),
    invalid_link_periods: z.number().int().nonnegative().safe(),
    identity_conflicts: z.number().int().min(0).max(1),
  })
  .strict()

type Props = Readonly<{
  appliedNames: ReadonlyArray<string>
  localNames: ReadonlyArray<string>
  migrationsDirectory: string
  query: (sql: string) => Promise<ReadonlyArray<unknown> | null>
}>

/** Account と従業員の接続条件を、制約を追加する前の DB で検査する。 */
export class CompanyAccountLinkMigrationPreflight {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async check(): Promise<z.infer<typeof countsSchema> | Error | null> {
    if (
      !this.props.localNames.includes(validationMigration) ||
      this.props.appliedNames.includes(validationMigration)
    )
      return null
    if (!this.props.appliedNames.includes("0081_bind_company_workforce_resources.sql"))
      return new Error(
        "Company account-link preflight requires the workforce schema; review the older database before migration",
      )

    const query = this.buildQuery()
    if (query instanceof Error) return query
    const rows = await this.props.query(query)
    if (rows === null || rows.length !== 1)
      return new Error("Company account-link preflight returned no single count row")
    const counts = countsSchema.safeParse(rows[0])
    if (!counts.success) return new Error("Company account-link preflight returned invalid counts")
    if (Object.values(counts.data).some((count) => count !== 0))
      return new Error(
        `Company account-link migration is not ready: ${JSON.stringify(counts.data)}. ` +
          "Confirm existing identities and histories, then complete audited employee adoption before applying migrations. Do not bypass the validation or rewrite the migration journal.",
      )
    return counts.data
  }

  private buildQuery(): string | Error {
    const bindings = readFileSync(join(this.props.migrationsDirectory, bindingMigration), "utf8")
    const copyCheck = bindings.match(
      /INSERT INTO _company_account_link_copy_check \(ok\)\s*(SELECT[\s\S]*?);/,
    )?.[1]
    const projection = bindings.match(
      /INSERT INTO company_account_employee_resource_bindings\s*\([^;]*?\)\s*(SELECT[\s\S]*?);/,
    )?.[1]
    const periods = readFileSync(
      join(this.props.migrationsDirectory, "0148_create_company_account_employee_link_periods.sql"),
      "utf8",
    ).match(/^CREATE VIEW company_account_employee_link_periods AS\s*([\s\S]*?);/)?.[1]
    const violations = readFileSync(
      join(
        this.props.migrationsDirectory,
        "0153_create_company_account_link_period_violations.sql",
      ),
      "utf8",
    ).match(/^CREATE VIEW company_account_employee_link_period_violations AS\s*([\s\S]*?);/)?.[1]
    if (
      copyCheck === undefined ||
      projection === undefined ||
      periods === undefined ||
      violations === undefined
    )
      return new Error("Company account-link migration SQL changed; review the read-only preflight")

    // 適用済み binding は実表を読む。未適用のときだけ、同じ SELECT を CTE にして再現する。
    const bindingProjection = this.props.appliedNames.includes(bindingMigration)
      ? ""
      : `company_account_employee_resource_bindings(resource_id, organization_id, account_id, employee_id, recorded_at) AS (${projection}),`
    return `WITH ${bindingProjection}
      company_account_employee_link_periods AS (${periods}),
      company_account_employee_link_period_violations AS (${violations})
      SELECT
        (SELECT count(*) FROM company_resource_heads resource
          WHERE resource.resource_type = 'account-employee-link' AND NOT EXISTS (
            SELECT 1 FROM company_workforce_resource_bindings employee
            WHERE employee.organization_id = resource.organization_id AND employee.resource_type = 'employee'
              AND employee.resource_id = json_extract(resource.attributes_json, '$.employeeId')
          )) AS unconnected_resource_links,
        (SELECT count(*) FROM company_account_employee_resource_bindings link WHERE NOT EXISTS (
          SELECT 1 FROM company_workforce_resource_bindings employee
          WHERE employee.organization_id = link.organization_id AND employee.resource_type = 'employee'
            AND employee.resource_id = link.employee_id
        )) AS unconnected_bound_links,
        (SELECT count(*) FROM company_account_employee_link_period_violations) AS invalid_link_periods,
        1 - (${copyCheck}) AS identity_conflicts`
  }
}
