import { expect, test } from "bun:test"
import { createEmployeeAdoptionBatchFixture } from "@/contexts/company/test/employee-resource-adoption-batch.test-support"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"

async function fixture(hasInitialAction = true) {
  const context = await createEmployeeAdoptionBatchFixture(1)
  const employeeId = restoreWorkforceId("employee", "employee:ended")
  await context.database.exec(`
    INSERT INTO company_employees (id, official_name, employee_code, email, phone, created_at, updated_at)
      VALUES ('employee:ended', 'Former Employee', 'ENDED-1', NULL, NULL, 0, 0);
    INSERT INTO company_employments (id, employee_id, contract_name, employment_type, hire_date, termination_date, status, created_at, updated_at)
      VALUES ('employment:ended', 'employee:ended', 'Former Employee', 'FULL_TIME', '2020-01-01', '2026-08-16', 'TERMINATED', 0, 0);
    INSERT INTO company_employee_lifecycle_revisions (employee_id, revision, updated_at)
      VALUES ('employee:ended', 1, 0);
    INSERT INTO company_personnel_actions
      (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id, requested_by_employee_id,
       source_type, source_application_id, corrects_action_id, operation_id, payload_fingerprint, summary_json)
      VALUES ('${hasInitialAction ? "initial:ended" : "unrelated:ended"}', 'employee:ended', 'initial_state', '2020-01-01', 0, NULL, NULL,
       'system', NULL, NULL, 'initial:ended', '${"0".repeat(64)}',
       '{"kind":"initial_state","eventOn":"2020-01-01","department":null,"positionTitle":null,"managerEmployeeCode":null,"status":"retired"}');
    INSERT INTO company_employment_period_versions (period_id, revision, employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES ('employment:ended', 1, 'employee:ended', '2020-01-01', '2026-08-16', 0, 'initial:ended', 0);
    INSERT INTO company_employee_status_period_versions
      (period_id, revision, employment_period_id, employee_id, status, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES ('status:ended', 1, 'employment:ended', 'employee:ended', 'active', '2020-01-01', '2026-08-16', 0, 'initial:ended', 0);
  `)
  const resources = [
    {
      type: "person",
      id: "person:ended",
      effectiveTo: null,
      attributes: { officialName: "Former Employee" },
    },
    {
      type: "employee",
      id: employeeId,
      effectiveTo: null,
      attributes: { personId: "person:ended", employeeCode: "ENDED-1" },
    },
    {
      type: "employment",
      id: "employment:ended",
      effectiveTo: "2026-08-17",
      attributes: {
        employeeId,
        officialName: "Former Employee",
        employmentType: "FULL_TIME",
        status: "RETIRED",
      },
    },
  ]
  for (const resource of resources) {
    await context.database.batch([
      context.database
        .prepare(`INSERT INTO company_resource_revisions
        (organization_id, resource_type, resource_id, revision, organization_revision, state,
         effective_from, effective_to, attributes_json, command_id, actor_account_id, reason, recorded_at)
        VALUES ('organization:default', ?1, ?2, 1, 1, 'active', '2020-01-01', ?3, ?4, 'initial-import', 'system:migration', 'Initial import', 0)`)
        .bind(
          resource.type,
          resource.id,
          resource.effectiveTo,
          JSON.stringify(resource.attributes),
        ),
      context.database
        .prepare(`INSERT INTO company_resource_heads
        (organization_id, resource_type, resource_id, revision, organization_revision, state,
         effective_from, effective_to, attributes_json, updated_at)
        VALUES ('organization:default', ?1, ?2, 1, 1, 'active', '2020-01-01', ?3, ?4, 0)`)
        .bind(
          resource.type,
          resource.id,
          resource.effectiveTo,
          JSON.stringify(resource.attributes),
        ),
    ])
  }
  context.employees.push({ employeeId, accountId: "unlinked" })
  const input = await context.input()
  const correctedInput = {
    ...input,
    employees: input.employees.map((employee) =>
      employee.employeeId === employeeId
        ? {
            ...employee,
            terminationBoundaryCorrection: {
              employmentId: "employment:ended",
              endsOn: "2026-08-17",
            },
            corrections: [
              {
                organizationId: "organization:default",
                type: "employment",
                id: "employment:ended",
                revision: 2,
                state: "active",
                effectiveFrom: "2020-01-01",
                effectiveTo: "2026-08-17",
                attributes: {
                  employeeId,
                  officialName: "Former Employee",
                  employmentType: "FULL_TIME",
                  status: "ACTIVE",
                },
              },
            ],
          }
        : employee,
    ),
  }
  return { ...context, correctedInput }
}

test("退職日と公開終了日が裏付ける初期期間だけを追記補正し、元の退職日と全履歴を保全する", async () => {
  const context = await fixture()
  const before = await context.legacy()
  const response = await context.post(context.correctedInput)
  expect(await response.json()).toMatchObject({ organizationRevision: 3, replayed: false })
  expect(response.status).toBe(200)
  const after = await context.legacy()
  expect(after[0]).toEqual(before[0])
  expect(after[1]).toEqual(before[1])
  for (const index of [2, 3, 4])
    expect(after[index]).toEqual(expect.arrayContaining(before[index] ?? []))
  expect(after[3]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        period_id: "employment:ended",
        revision: 2,
        ends_on: "2026-08-17",
      }),
    ]),
  )
  expect(after[4]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ period_id: "status:ended", revision: 2, ends_on: "2026-08-17" }),
    ]),
  )
  expect(after[2]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "employment_revised",
        recorded_by_account_id: context.actor.accountId,
        corrects_action_id: "initial:ended",
      }),
    ]),
  )
  const state = await context.state()
  expect(state[1]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        resource_id: "employment:ended",
        resource_revision: 2,
        lifecycle_revision: 2,
        last_action_id: expect.any(String),
      }),
    ]),
  )
  expect((await context.post(context.correctedInput)).status).toBe(200)
  expect(await context.legacy()).toEqual(after)
  expect(await context.state()).toEqual(state)
})

test("終了日を推測する補正や公開訂正を伴わない依頼を拒否する", async () => {
  const context = await fixture()
  const before = await context.legacy()
  for (const endsOn of ["2026-08-16", "2026-08-18"]) {
    const employees = context.correctedInput.employees.map((employee) =>
      "terminationBoundaryCorrection" in employee
        ? {
            ...employee,
            terminationBoundaryCorrection: { ...employee.terminationBoundaryCorrection, endsOn },
          }
        : employee,
    )
    expect((await context.post({ ...context.correctedInput, employees })).status).toBe(422)
  }
  const employees = context.correctedInput.employees.map((employee) => ({
    ...employee,
    corrections: undefined,
  }))
  expect((await context.post({ ...context.correctedInput, employees })).status).toBe(422)
  expect(await context.legacy()).toEqual(before)
})

test("最後の接続保存の失敗は期間補正と人事発令も取り消し、同じキーで再試行できる", async () => {
  const context = await fixture()
  const before = await context.legacy()
  const originalState = await context.state()
  await context.database
    .exec(`CREATE TRIGGER fail_ended_adoption BEFORE INSERT ON company_employee_resource_adoptions
    WHEN NEW.employee_id = 'employee:ended' BEGIN SELECT RAISE(ABORT, 'injected final failure'); END`)
  expect((await context.post(context.correctedInput)).status).toBe(503)
  expect(await context.legacy()).toEqual(before)
  expect(await context.state()).toEqual(originalState)
  await context.database.exec("DROP TRIGGER fail_ended_adoption")
  expect((await context.post(context.correctedInput)).status).toBe(200)
})

test("初期期間の訂正元が存在しなければ架空の人事発令を参照する補正を保存しない", async () => {
  const context = await fixture(false)
  const before = await context.legacy()
  const state = await context.state()
  expect((await context.post(context.correctedInput)).status).toBe(503)
  expect(await context.legacy()).toEqual(before)
  expect(await context.state()).toEqual(state)
})
