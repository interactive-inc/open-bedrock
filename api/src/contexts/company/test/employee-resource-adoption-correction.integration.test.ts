import { expect, test } from "bun:test"
import { createEmployeeAdoptionBatchFixture } from "@/contexts/company/test/employee-resource-adoption-batch.test-support"
import type { AdoptionResource } from "@/contexts/company/test/employee-resource-adoption.test-support"
import { CompanyEmploymentResourceHistoryAdapter } from "@/contexts/company/infrastructure/adapters/employee/company-employment-resource-history.adapter"
import { CompanyEmploymentResourceTimelineValue } from "@/contexts/company/domain/values/company-employment-resource-timeline.value"

async function fixture() {
  const imported: AdoptionResource[] = []
  const context = await createEmployeeAdoptionBatchFixture(2, 0, (resource) => {
    if (!resource.id.endsWith("batch-1")) return resource
    const stale = {
      ...resource,
      effectiveFrom: "2026-07-31",
      attributes: { ...resource.attributes },
    }
    if (stale.type === "employment") stale.attributes["status"] = "RETIRED"
    imported.push(stale)
    return stale
  })
  const corrections = imported.map((resource) => ({
    ...resource,
    revision: 2,
    effectiveFrom: resource.type === "employment" ? resource.effectiveFrom : "2020-01-01",
    attributes: { ...resource.attributes },
  }))
  const employment = corrections.find((resource) => resource.type === "employment")
  if (employment === undefined) throw new Error("missing employment")
  employment.attributes["status"] = "ACTIVE"
  corrections.push({ ...employment, revision: 3, effectiveFrom: "2020-01-01" })
  const input = await context.input()
  return {
    ...context,
    correctedInput: {
      ...input,
      employees: input.employees.map((employee) =>
        employee.employeeId === "employee:batch-1" ? { ...employee, corrections } : employee,
      ),
    },
  }
}

test("原履歴を保全して訂正と全員の接続を原子的に保存し、同じ依頼を再実行しない", async () => {
  const context = await fixture()
  const original = await context.state()
  const legacy = await context.legacy()
  expect((await context.post(await context.input())).status).toBe(422)
  const response = await context.post(context.correctedInput)
  expect(await response.json()).toMatchObject({ organizationRevision: 6, replayed: false })
  expect(response.status).toBe(200)
  const after = await context.state()
  expect(after[4]).toEqual(expect.arrayContaining(original[4] ?? []))
  expect(after[4]?.length).toBe((original[4]?.length ?? 0) + 4)
  expect(after[1]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ resource_id: "employee:batch-1", resource_revision: 2 }),
      expect.objectContaining({ resource_id: "employment:batch-1", resource_revision: 3 }),
    ]),
  )
  expect(after[4]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        resource_id: "employment:batch-1",
        revision: 3,
        actor_account_id: context.actor.accountId,
        command_id: expect.stringMatching(/^employee-adoption-batch-part:[a-f0-9]{64}:3$/),
        reason: context.correctedInput.reason,
      }),
    ]),
  )
  expect(await context.legacy()).toEqual(legacy)
  const history = await new CompanyEmploymentResourceHistoryAdapter(context.database).read({
    organizationId: "organization:default",
    id: "employment:batch-1",
  })
  if (history instanceof Error) throw history
  expect(history[0]?.attributes["status"]).toBe("RETIRED")
  expect(CompanyEmploymentResourceTimelineValue.create(history)).toMatchObject({
    revision: 3,
    periods: [{ startsOn: "2020-01-01", endsOn: null, status: "active" }],
  })
  expect((await context.post(context.correctedInput)).status).toBe(200)
  expect(await context.state()).toEqual(after)
})

test("訂正後の最後の監査保存に失敗しても訂正版と接続を全て取り消す", async () => {
  const context = await fixture()
  await context.database
    .exec(`CREATE TRIGGER reject_corrected_receipt BEFORE INSERT ON company_employee_resource_adoptions
    WHEN NEW.employee_id = 'employee:batch-1' BEGIN SELECT RAISE(ABORT, 'injected failure'); END`)
  const before = await context.state()
  const legacy = await context.legacy()
  expect((await context.post(context.correctedInput)).status).toBe(503)
  expect(await context.state()).toEqual(before)
  expect(await context.legacy()).toEqual(legacy)
  await context.database.exec("DROP TRIGGER reject_corrected_receipt")
  expect((await context.post(context.correctedInput)).status).toBe(200)
})

test("元の版の上書き・版の欠落・別人への名寄せ・台帳にない期間を拒否する", async () => {
  const context = await fixture()
  const before = await context.state()
  for (const change of [
    { revision: 1 },
    { revision: 9 },
    { id: "employment:other" },
    { effectiveFrom: "2019-01-01" },
    { attributes: { employeeId: "employee:other", employmentType: "PART_TIME", status: "ACTIVE" } },
  ]) {
    const employees = context.correctedInput.employees.map((employee) => ({
      ...employee,
      corrections:
        "corrections" in employee
          ? employee.corrections.map((resource) =>
              resource.type === "employment" && resource.revision === 3
                ? { ...resource, ...change }
                : resource,
            )
          : undefined,
    }))
    expect((await context.post({ ...context.correctedInput, employees })).status).toBe(422)
    expect(await context.state()).toEqual(before)
  }
})
