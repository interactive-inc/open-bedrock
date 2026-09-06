import type { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import { CompanyEmploymentResourceProjectionAdapter } from "@/contexts/company/infrastructure/adapters/employee/company-employment-resource-projection.adapter"
import { AbortWhenPreviousStatementChangedNoRowsAdapter } from "@/contexts/company/infrastructure/adapters/database/abort-when-previous-statement-changed-no-rows.adapter"

type Context = D1Database

/** 公開Company resourceと業務の人・雇用を、同じcommandのtransactionへ接続する。 */
export class CompanyWorkforceResourceProjectionAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    change: CompanyResourceChangeEntity,
    fingerprint: string,
  ): Promise<ReadonlyArray<D1PreparedStatement> | Error> {
    const statements: D1PreparedStatement[] = []
    const revisions = new Map<string, number>()

    // 既存業務台帳は単一Companyを所有し、organizationを分離する列を持たない。
    // 別organizationのresourceを同じ台帳へ混ぜると既存業務の参照範囲を広げてしまう。
    if (
      change.resources.some(
        (resource) =>
          (resource.type === "employee" || resource.type === "employment") &&
          resource.organizationId !== "organization:default",
      )
    )
      return new CompanyResourceValidationError("invalid_resource")

    for (const resource of change.resources) {
      if (
        resource.type !== "person" &&
        resource.type !== "employee" &&
        resource.type !== "employment"
      )
        continue
      if (!this.hasWorkforceShape(resource))
        return new CompanyResourceValidationError("invalid_resource")
      if (resource.type === "person") {
        statements.push(...this.personStatements(resource, change.recordedAt))
      }
    }
    for (const resource of change.resources.filter((resource) => resource.type === "employee")) {
      const prepared = await this.employeeStatements(resource, change.recordedAt)
      if (prepared instanceof Error) return prepared
      statements.push(...prepared)
    }
    const employments = change.resources
      .filter((resource) => resource.type === "employment")
      .toSorted(
        (left, right) =>
          Number(left.effectiveTo === null && left.readText("status") !== "TERMINATED") -
          Number(right.effectiveTo === null && right.readText("status") !== "TERMINATED"),
      )
    for (const resource of employments) {
      const employeeId = resource.readText("employeeId")
      if (employeeId === null) return new CompanyResourceValidationError("invalid_resource")
      const prepared = await new CompanyEmploymentResourceProjectionAdapter(this.c).prepare({
        resource,
        change,
        fingerprint,
        revisionOffset: revisions.get(employeeId) ?? 0,
      })
      if (prepared instanceof Error) return prepared
      statements.push(...prepared)
      revisions.set(employeeId, (revisions.get(employeeId) ?? 0) + 1)
    }
    for (const employeeId of revisions.keys()) {
      statements.push(
        this.c
          .prepare(`UPDATE company_workforce_resource_bindings
        SET lifecycle_revision = (SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = ?1)
        WHERE employee_id = ?1`)
          .bind(employeeId),
      )
    }
    return statements
  }

  private hasWorkforceShape(resource: CompanyResourceEntity): boolean {
    if (resource.type === "person") {
      const name = resource.readText("officialName")
      const phone = resource.readNullableText("phone")
      return (
        name !== null &&
        name.length <= 200 &&
        (phone === null || phone === undefined || phone.length <= 64)
      )
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(resource.id)) return false
    if (resource.type === "employee") {
      const code = resource.readNullableText("employeeCode")
      return code === null || code === undefined || code.length <= 64
    }
    const employmentType = resource.readText("employmentType")
    const name = resource.readNullableText("officialName")
    return (
      (employmentType === "FULL_TIME" || employmentType === "PART_TIME") &&
      (name === null || name === undefined || name.length <= 200)
    )
  }

  private personStatements(
    resource: CompanyResourceEntity,
    recordedAt: number,
  ): ReadonlyArray<D1PreparedStatement> {
    if (resource.state === "void") return []
    return [
      this.c
        .prepare(`UPDATE company_employees
      SET official_name = ?1, email = ?2, phone = ?3, updated_at = max(updated_at, ?4)
      WHERE id IN (
        SELECT binding.employee_id FROM company_workforce_resource_bindings AS binding
        JOIN company_resource_heads AS employee ON employee.organization_id = binding.organization_id
          AND employee.resource_type = 'employee' AND employee.resource_id = binding.resource_id
        WHERE binding.resource_type = 'employee' AND binding.organization_id = ?5
          AND json_extract(employee.attributes_json, '$.personId') = ?6
      )`)
        .bind(
          resource.readText("officialName"),
          resource.readNullableText("email") ?? null,
          resource.readNullableText("phone") ?? null,
          recordedAt,
          resource.organizationId,
          resource.id,
        ),
      this.c
        .prepare(`UPDATE company_account_profiles
        SET display_name = ?1, updated_at = max(updated_at, ?2)
        WHERE organization_id = ?3 AND account_id IN (
          SELECT link.account_id FROM company_account_employee_links AS link
          JOIN company_workforce_resource_bindings AS binding ON binding.employee_id = link.employee_id
          JOIN company_resource_heads AS employee ON employee.organization_id = binding.organization_id
            AND employee.resource_type = 'employee' AND employee.resource_id = binding.resource_id
          WHERE binding.resource_type = 'employee' AND binding.organization_id = ?3
            AND json_extract(employee.attributes_json, '$.personId') = ?4
        )`)
        .bind(resource.readText("officialName"), recordedAt, resource.organizationId, resource.id),
    ]
  }

  private async employeeStatements(
    resource: CompanyResourceEntity,
    recordedAt: number,
  ): Promise<ReadonlyArray<D1PreparedStatement> | Error> {
    const binding = await this.c
      .prepare(`SELECT organization_id, resource_revision FROM company_workforce_resource_bindings
      WHERE resource_type = 'employee' AND resource_id = ?1`)
      .bind(resource.id)
      .first<{ organization_id: string; resource_revision: number }>()
    if (
      (binding === null && resource.revision !== 1) ||
      (binding !== null &&
        (binding.organization_id !== resource.organizationId ||
          binding.resource_revision !== resource.revision - 1))
    ) {
      return new CompanyResourceValidationError("invalid_resource")
    }
    if (resource.state === "void") {
      return [
        this.c
          .prepare(`UPDATE company_workforce_resource_bindings SET resource_revision = ?1
          WHERE resource_type = 'employee' AND resource_id = ?2 AND organization_id = ?3`)
          .bind(resource.revision, resource.id, resource.organizationId),
      ]
    }
    const statements: D1PreparedStatement[] = []
    if (binding === null) {
      statements.push(
        this.c
          .prepare(`INSERT INTO company_employees
        (id, official_name, employee_code, email, phone, created_at, updated_at)
        SELECT ?1, json_extract(person.attributes_json, '$.officialName'), ?2,
          json_extract(person.attributes_json, '$.email'), json_extract(person.attributes_json, '$.phone'), ?3, ?3
        FROM company_resource_heads AS person
        WHERE person.organization_id = ?4 AND person.resource_type = 'person'
          AND person.resource_id = ?5 AND person.state = 'active'`)
          .bind(
            resource.id,
            resource.readNullableText("employeeCode") ?? null,
            recordedAt,
            resource.organizationId,
            resource.readText("personId"),
          ),
      )
      statements.push(
        new AbortWhenPreviousStatementChangedNoRowsAdapter(
          this.c,
        ).abortWhenPreviousStatementChangedNoRows(),
      )
      statements.push(
        this.c
          .prepare(`INSERT INTO company_workforce_resource_bindings
        (resource_type, resource_id, organization_id, employee_id, resource_revision, lifecycle_revision, last_action_id)
        VALUES ('employee', ?1, ?2, ?1, ?3, 0, NULL)`)
          .bind(resource.id, resource.organizationId, resource.revision),
      )
      return statements
    }
    statements.push(
      this.c
        .prepare(`UPDATE company_employees SET employee_code = ?1, updated_at = max(updated_at, ?2)
      WHERE id = ?3`)
        .bind(resource.readNullableText("employeeCode") ?? null, recordedAt, resource.id),
    )
    statements.push(
      new AbortWhenPreviousStatementChangedNoRowsAdapter(
        this.c,
      ).abortWhenPreviousStatementChangedNoRows(),
    )
    statements.push(
      this.c
        .prepare(`UPDATE company_workforce_resource_bindings SET resource_revision = ?1
      WHERE resource_type = 'employee' AND resource_id = ?2 AND organization_id = ?3`)
        .bind(resource.revision, resource.id, resource.organizationId),
    )
    return statements
  }
}
