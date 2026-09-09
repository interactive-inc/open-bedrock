import { drizzle } from "drizzle-orm/d1"
import { createEmployeeAdoptionFixture } from "@/contexts/company/test/employee-resource-adoption.test-support"
import type { AdoptionResource } from "@/contexts/company/test/employee-resource-adoption.test-support"
import { InitialEmploymentPersistenceAdapter } from "@/contexts/company/infrastructure/adapters/employee/initial-employment-persistence.adapter"
import { EmployeeResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/employee-resource-adoption/employee-resource-adoption-snapshot.adapter"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"

/** 公開Account対応だけが先に存在し、全員の接続を同時に必要とする会社を用意する。 */
export async function createEmployeeAdoptionBatchFixture(
  count = 2,
  extraPersonRevisions = 0,
  transformHistory: (resource: AdoptionResource) => AdoptionResource = (resource) => resource,
) {
  const context = await createEmployeeAdoptionFixture()
  const resources: AdoptionResource[] = [...context.resources]
  const employees = [{ employeeId: "employee:adoption", accountId: "account:adoption" }]
  for (const index of Array.from({ length: count - 1 }, (_, offset) => offset + 1)) {
    const employeeId = restoreWorkforceId("employee", `employee:batch-${index}`)
    const employmentId = restoreWorkforceId("employment", `employment:batch-${index}`)
    const accountId = `account:batch-${index}`
    const officialName = `Person ${index}`
    const employeeCode = `BATCH-${index}`
    await context.database.batch([
      context.database
        .prepare(`INSERT INTO company_employees
        (id, official_name, employee_code, email, phone, created_at, updated_at)
        VALUES (?1, ?2, ?3, NULL, NULL, 0, 0)`)
        .bind(employeeId, officialName, employeeCode),
      context.database
        .prepare(`INSERT INTO company_employments
        (id, employee_id, contract_name, employment_type, hire_date, termination_date, status, created_at, updated_at)
        VALUES (?1, ?2, 'Confirmed Contract', 'PART_TIME', '2020-01-01', NULL, 'ACTIVE', 0, 0)`)
        .bind(employmentId, employeeId),
      context.database
        .prepare(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
        VALUES (?1, 'active', 0, 0, 0)`)
        .bind(accountId),
      context.database
        .prepare(
          "INSERT INTO company_account_employee_links (account_id, employee_id) VALUES (?1, ?2)",
        )
        .bind(accountId, employeeId),
      context.database
        .prepare(`INSERT INTO company_account_profiles
        (organization_id, account_id, display_name, created_at, updated_at)
        VALUES ('organization:default', ?1, ?2, 0, 0)`)
        .bind(accountId, officialName),
    ])
    const initial = await new InitialEmploymentPersistenceAdapter({
      env: context.environment,
      var: { database: drizzle(context.database) },
    }).prepare({
      employeeId,
      employmentId,
      effectiveOn: restoreCalendarDate("2020-01-01"),
      status: "active",
      occurredAt: new Date("2020-01-01T00:00:00Z"),
      actorAccountId: context.actor.accountId,
      operationId: `historical-${index}`,
      reason: "Confirmed historical registration",
    })
    if (initial instanceof Error) throw initial
    await context.database.batch([...initial])
    const person: AdoptionResource = {
      organizationId: "organization:default",
      type: "person",
      id: `person:batch-${index}`,
      revision: 1,
      state: "active",
      effectiveFrom: "2020-01-01",
      effectiveTo: null,
      attributes: { officialName, email: null, phone: null },
    }
    resources.push(
      person,
      {
        ...person,
        type: "employee",
        id: employeeId,
        attributes: { personId: person.id, employeeCode },
      },
      {
        ...person,
        type: "employment",
        id: employmentId,
        attributes: {
          employeeId,
          employmentType: "PART_TIME",
          officialName: "Confirmed Contract",
          status: "ACTIVE",
        },
      },
    )
    employees.push({ employeeId, accountId })
  }
  const latestPeople = new Map<string, AdoptionResource>()
  for (const resource of resources) {
    if (resource.type === "person") latestPeople.set(resource.id, resource)
  }
  for (const person of latestPeople.values()) {
    for (const offset of Array.from({ length: extraPersonRevisions }, (_, index) => index + 1)) {
      resources.push({ ...person, revision: person.revision + offset })
    }
  }
  const seedResource = async (
    resource: Omit<AdoptionResource, "type"> & Readonly<{ type: string }>,
  ) => {
    await context.database.batch([
      context.database
        .prepare(`INSERT INTO company_resource_revisions
        (organization_id, resource_type, resource_id, revision, organization_revision,
         state, effective_from, effective_to, attributes_json, command_id, actor_account_id, reason, recorded_at)
        VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?6, ?7, ?8, 'confirmed-history-import', 'account:adoption', ?9, 10)`)
        .bind(
          resource.organizationId,
          resource.type,
          resource.id,
          resource.revision,
          resource.state,
          resource.effectiveFrom,
          resource.effectiveTo,
          JSON.stringify(resource.attributes),
          resource.type === "person" && resource.revision > 2
            ? "確認".repeat(1000)
            : "Historical import",
        ),
      context.database
        .prepare(`INSERT INTO company_resource_heads
        (organization_id, resource_type, resource_id, revision, organization_revision,
         state, effective_from, effective_to, attributes_json, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?6, ?7, ?8, 10)
        ON CONFLICT (organization_id, resource_type, resource_id) DO UPDATE SET
          revision = excluded.revision, organization_revision = excluded.organization_revision,
          state = excluded.state, effective_from = excluded.effective_from,
          effective_to = excluded.effective_to, attributes_json = excluded.attributes_json`)
        .bind(
          resource.organizationId,
          resource.type,
          resource.id,
          resource.revision,
          resource.state,
          resource.effectiveFrom,
          resource.effectiveTo,
          JSON.stringify(resource.attributes),
        ),
    ])
  }
  for (const resource of resources) await seedResource(transformHistory(resource))
  await context.database.batch(
    Array.from({ length: 2 + extraPersonRevisions }, (_, index) =>
      context.database.prepare("UPDATE company_organizations SET revision = ?1").bind(index + 1),
    ),
  )
  for (const employee of employees) {
    const resourceId = `account-link:${employee.employeeId}`
    await seedResource({
      organizationId: "organization:default",
      type: "account-employee-link",
      id: resourceId,
      revision: 1,
      state: "active",
      effectiveFrom: "2020-01-01",
      effectiveTo: null,
      attributes: { accountId: employee.accountId, employeeId: employee.employeeId },
    })
    await context.database
      .prepare(`INSERT INTO company_account_employee_resource_bindings
      (resource_id, account_id, employee_id, recorded_at) VALUES (?1, ?2, ?3, 10)`)
      .bind(resourceId, employee.accountId, employee.employeeId)
      .run()
  }
  const input = async () => {
    const snapshots = await new EmployeeResourceAdoptionSnapshotAdapter(context.database).findMany(
      employees.map((employee) => employee.employeeId),
    )
    if (snapshots instanceof Error) throw snapshots
    return {
      expectedRevision: snapshots[0]!.props.value.organizationRevision!,
      observedOn: "2026-09-07",
      reason: "Confirmed against personnel records",
      employees: snapshots.map((snapshot) => ({
        employeeId: snapshot.props.value.employee.id,
        snapshotDigest: snapshot.props.digest,
      })),
    }
  }
  const post = (body: unknown, key = "adoption-batch-command") =>
    context.app.request(
      "/company/employee-resource-adoption-batches",
      {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify(body),
      },
      context.environment,
    )
  const state = async () =>
    Promise.all(
      [
        "company_organizations",
        "company_workforce_resource_bindings",
        "company_command_receipts",
        "company_employee_resource_adoptions",
        "company_resource_revisions",
        "company_resource_heads",
        "company_account_employee_resource_bindings",
      ].map(
        async (table) =>
          (await context.database.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all()).results,
      ),
    )
  return {
    ...context,
    input,
    post,
    state,
    employees,
    singleInput: context.input,
    singlePost: context.post,
  }
}
