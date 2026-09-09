import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { AssignmentResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/organization/assignment-resource-adoption-snapshot.adapter"
import { describe, expect, test, spyOn } from "bun:test"
import { z } from "zod"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"

async function fixture(secondStartsOn = "2030-04-01", managerRetires = false) {
  const base = await createCompanyAssignmentResourceTestContext()
  expect(
    Number(
      (
        await base.write([
          {
            organizationId: "organization:default",
            type: "organization-unit",
            id: "unit-period:adoption",
            revision: 1,
            state: "active",
            effectiveFrom: "2030-01-01",
            effectiveTo: null,
            attributes: {
              organizationUnitId: "unit:adoption",
              code: "ADOPT",
              officialName: "Example Team",
              kind: "TEAM",
              parentOrganizationUnitId: base.root.id,
            },
          },
        ])
      ).status,
    ),
  ).toBe(201)
  await base.assignEmployeeCode()
  await base.assignEmployeeCode(base.people[1]!.employeeId, "MANAGER-001")
  await base.assignEmployeeCode(base.people[2]!.employeeId, "MANAGER-002")
  if (managerRetires) {
    expect(
      await base.personnel(
        {
          kind: "retired",
          employeeCode: "MANAGER-002",
          retirementOn: restoreCalendarDate("2030-06-30"),
        },
        "manager:retire-before-adoption",
        base.people[2]!.employeeId,
      ),
    ).toMatchObject({ replayed: false })
  }
  const revision = await base.database
    .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
    .first<number>("revision")
  const legacy = [
    {
      id: "assignment:legacy-one",
      revision: 1,
      startsOn: "2030-01-01",
      endsOn: null,
      manager: base.people[1]!.employeeId,
    },
    {
      id: "assignment:legacy-one",
      revision: 2,
      startsOn: "2030-02-01",
      endsOn: "2030-04-01",
      manager: base.people[1]!.employeeId,
    },
    {
      id: "assignment:legacy-two",
      revision: 1,
      startsOn: secondStartsOn,
      endsOn: null,
      manager: base.people[2]!.employeeId,
    },
  ]
  const assignmentGuard = await base.database
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'company_organization_assignment_period_versions_guard'",
    )
    .first<string>("sql")
  if (assignmentGuard === null) throw new Error("assignment guard missing")
  if (managerRetires)
    await base.database.exec("DROP TRIGGER company_organization_assignment_period_versions_guard")
  await base.database.batch([
    base.database
      .prepare(`INSERT INTO company_organization_change_operations
      (id, expected_revision, change_count, applied_count, resulting_revision, status, recorded_at, actor_account_id, reason)
      VALUES ('legacy:adoption-source', ?1, 3, 0, ?1 + 3, 'PENDING', 0, ?2, 'Record original assignment history')`)
      .bind(revision, base.creator.accountId),
    ...legacy.map((period) =>
      base.database
        .prepare(`INSERT INTO company_organization_assignment_period_versions
      (period_id, revision, employment_id, employee_id, organization_unit_id, assignment_type, position_title, manager_employee_id,
       starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES (?1, ?2, ?3, ?4, 'unit:adoption', 'PRIMARY', 'Coordinator', ?5, ?6, ?7, 0, 'legacy:adoption-source', 0)`)
        .bind(
          period.id,
          period.revision,
          base.assignment.attributes.employmentId,
          base.people[0]!.employeeId,
          period.manager,
          period.startsOn,
          period.endsOn,
        ),
    ),
    base.database.prepare(
      "UPDATE company_organization_change_operations SET status = 'COMPLETED' WHERE id = 'legacy:adoption-source'",
    ),
  ])
  if (managerRetires) await base.database.exec(assignmentGuard)
  const preview = async () => {
    const response = await base.client["assignment-adoptions"].$get({
      query: { employee_id: base.people[0]!.employeeId },
    })
    expect(Number(response.status)).toBe(200)
    return z
      .object({
        expectedRevision: z.number(),
        snapshotDigest: z.string(),
        observedOn: z.string(),
        snapshot: z.object({ periods: z.array(z.unknown()) }),
      })
      .parse(await response.json())
  }
  const first = await preview()
  const input = {
    employeeId: base.people[0]!.employeeId,
    expectedRevision: first.expectedRevision,
    snapshotDigest: first.snapshotDigest,
    observedOn: first.observedOn,
    reason: "Confirm all original assignment history",
  }
  const adopt = (key = "assignment:adopt", body = input) =>
    base.client["assignment-adoptions"].$post({ header: { "idempotency-key": key }, json: body })
  return { ...base, preview, input, adopt, first }
}

describe("既存の所属・上長履歴の公開正本への接続", () => {
  test("過去の訂正と元の全改訂を保全し、移行後の上長変更・訂正・退職も同じ履歴へ反映する", async () => {
    const f = await fixture()
    expect(f.first.snapshot.periods).toHaveLength(3)
    const source = await f.database
      .prepare(
        "SELECT * FROM company_organization_assignment_period_versions WHERE recorded_by_action_id = 'legacy:adoption-source' ORDER BY period_id, revision",
      )
      .all()
    const beforeReads = await Promise.all(
      ["2030-01-31", "2030-02-01", "2030-04-01"].map((date) => f.read(date)),
    )
    const response = await f.adopt()
    expect(await response.json()).toMatchObject({ adoptedPeriods: 2, replayed: false })
    expect(Number(response.status)).toBe(201)
    expect(
      await Promise.all(["2030-01-31", "2030-02-01", "2030-04-01"].map((date) => f.read(date))),
    ).toEqual(beforeReads)
    const saved = await f.persisted()
    expect(Number((await f.adopt()).status)).toBe(200)
    expect(await f.persisted()).toEqual(saved)
    expect(
      (
        await f.database
          .prepare(
            "SELECT * FROM company_organization_assignment_period_versions WHERE recorded_by_action_id = 'legacy:adoption-source' ORDER BY period_id, revision",
          )
          .all()
      ).results,
    ).toEqual(source.results)
    expect(await f.publicAssignments("2030-01-31")).toEqual([])
    expect(await f.publicReporting("2030-01-31")).toEqual([])
    expect(
      (await f.publicReporting("2030-02-01")).map((resource) =>
        resource.readText("managerEmployeeId"),
      ),
    ).toEqual([f.people[1]!.employeeId])
    expect(
      (await f.publicReporting("2030-04-01")).map((resource) =>
        resource.readText("managerEmployeeId"),
      ),
    ).toEqual([f.people[2]!.employeeId])
    const action = {
      kind: "manager_changed",
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-05-01"),
      departmentCode: "ADOPT",
      assignmentType: "primary",
      managerEmployeeCode: "MANAGER-001",
    } satisfies PersonnelActionInput
    const changed = await f.personnel(action, "assignment:manager-after-adoption")
    if (changed instanceof Error) throw changed
    expect(
      await f.personnel(
        {
          kind: "corrected",
          correctsActionId: changed.action.id,
          eventOn: restoreCalendarDate("2030-06-01"),
          reason: "Correct manager date after adoption",
          replacementAction: { ...action, eventOn: restoreCalendarDate("2030-05-15") },
        },
        "assignment:correct-after-adoption",
      ),
    ).toMatchObject({ replayed: false })
    expect(
      (await f.publicReporting("2030-05-01")).map((resource) =>
        resource.readText("managerEmployeeId"),
      ),
    ).toEqual([f.people[2]!.employeeId])
    expect(
      (await f.publicReporting("2030-05-15")).map((resource) =>
        resource.readText("managerEmployeeId"),
      ),
    ).toEqual([f.people[1]!.employeeId])
    expect(
      await f.personnel(
        {
          kind: "retired",
          employeeCode: "MANAGER-001",
          retirementOn: restoreCalendarDate("2030-06-30"),
        },
        "assignment:retire-manager",
        f.people[1]!.employeeId,
      ),
    ).toMatchObject({ replayed: false })
    expect(await f.publicReporting("2030-07-01")).toEqual([])
    expect(
      await f.database
        .prepare(`SELECT count(*) AS total FROM company_organization_assignment_period_versions period
      WHERE manager_employee_id IS NOT NULL AND revision = (SELECT max(latest.revision) FROM company_organization_assignment_period_versions latest WHERE latest.period_id = period.period_id)`)
        .first<number>("total"),
    ).toBe(0)
    const receipt = await f.database
      .prepare(
        "SELECT source_json FROM company_assignment_resource_adoptions WHERE command_id = 'assignment:adopt'",
      )
      .first<string>("source_json")
    if (receipt === null) throw new Error("adoption evidence missing")
    expect(JSON.parse(receipt).periods).toEqual(f.first.snapshot.periods)
  })
  test("移行証跡の保存失敗は公開履歴と期間改訂も巻き戻し、再試行で一度だけ接続する", async () => {
    const f = await fixture()
    const before = await f.persisted()
    await f.database.exec(
      "CREATE TRIGGER reject_adoption BEFORE INSERT ON company_assignment_resource_adoptions BEGIN SELECT RAISE(ABORT, 'injected adoption failure'); END;",
    )
    expect(Number((await f.adopt()).status)).toBe(503)
    expect(await f.persisted()).toEqual(before)
    expect(
      await f.database
        .prepare("SELECT count(*) AS total FROM company_assignment_resource_adoptions")
        .first<number>("total"),
    ).toBe(0)
    await f.database.exec("DROP TRIGGER reject_adoption")
    expect(Number((await f.adopt()).status)).toBe(201)
    const saved = await f.persisted()
    expect(Number((await f.adopt()).status)).toBe(200)
    expect(await f.persisted()).toEqual(saved)
    for (const sql of [
      "UPDATE company_assignment_resource_adoptions SET reason = 'Replaced evidence'",
      "DELETE FROM company_assignment_resource_adoptions",
    ]) {
      const failure = await f.database
        .prepare(sql)
        .run()
        .catch((cause: unknown) => cause)
      expect(failure).toBeInstanceOf(Error)
      if (!(failure instanceof Error)) throw new Error("missing immutable adoption receipt guard")
      expect(failure.message).toContain("immutable")
    }
    expect(
      await f.database
        .prepare(
          "SELECT recorded_by_action_id, recorded_by_adoption_id FROM company_personnel_reporting_bindings",
        )
        .first<{ recorded_by_action_id: string | null; recorded_by_adoption_id: string | null }>(),
    ).toEqual({ recorded_by_action_id: null, recorded_by_adoption_id: "assignment:adopt" })
  })

  test("上長の雇用を超える既存関係を移行せず、公開履歴と元の期間を変更しない", async () => {
    const f = await fixture("2030-04-01", true)
    const before = await f.persisted()
    const response = await f.adopt()
    expect(Number(response.status)).toBe(422)
    expect(await response.json()).toMatchObject({ code: "invalid_assignment_adoption" })
    expect(await f.persisted()).toEqual(before)
    expect(await f.publicReporting("2030-05-01")).toEqual([])
    expect(
      await f.database
        .prepare("SELECT count(*) AS total FROM company_assignment_resource_adoptions")
        .first<number>("total"),
    ).toBe(0)
  })

  test("同時再送は一度だけ移行し、異なる依頼での同時移行とキーの再利用は競合にする", async () => {
    const f = await fixture()
    const repeated = await Promise.all([f.adopt(), f.adopt()])
    expect(
      repeated.map((response) => Number(response.status)).sort((left, right) => left - right),
    ).toEqual([200, 201])
    expect(
      Number(
        (await f.adopt("assignment:adopt", { ...f.input, reason: "Different request" })).status,
      ),
    ).toBe(409)
    const other = await fixture()
    const raced = await Promise.all([
      other.adopt("assignment:first"),
      other.adopt("assignment:second"),
    ])
    expect(
      raced.map((response) => Number(response.status)).sort((left, right) => left - right),
    ).toEqual([201, 409])
    expect(
      await other.database
        .prepare("SELECT count(*) AS total FROM company_assignment_resource_adoptions")
        .first<number>("total"),
    ).toBe(1)
  })

  test("保存準備後の会社版変更を拒否し、確認し直した同じキーで接続する", async () => {
    const f = await fixture()
    const reader = new AssignmentResourceAdoptionSnapshotAdapter(f.database)
    const original = reader.find.bind(reader)
    const injected = spyOn(
      AssignmentResourceAdoptionSnapshotAdapter.prototype,
      "find",
    ).mockImplementationOnce(async (employeeId) => {
      const snapshot = await original(employeeId)
      await f.assignEmployeeCode(f.people[2]!.employeeId, "MANAGER-CHANGED")
      return snapshot
    })
    try {
      expect(Number((await f.adopt()).status)).toBe(409)
    } finally {
      injected.mockRestore()
    }
    expect(
      await f.database
        .prepare("SELECT count(*) AS total FROM company_assignment_resource_adoptions")
        .first<number>("total"),
    ).toBe(0)
    expect(Number((await f.adopt()).status)).toBe(409)
    const preview = await f.preview()
    const body = {
      ...f.input,
      expectedRevision: preview.expectedRevision,
      snapshotDigest: preview.snapshotDigest,
      observedOn: preview.observedOn,
    }
    expect(Number((await f.adopt("assignment:adopt", body)).status)).toBe(201)
  })

  test("既存の所属履歴に改訂の欠落がある場合は接続を拒否する", async () => {
    const broken = await fixture()
    await broken.database.exec(
      "DROP TRIGGER company_organization_assignment_period_versions_immutable_delete",
    )
    await broken.database
      .prepare(
        "DELETE FROM company_organization_assignment_period_versions WHERE period_id = 'assignment:legacy-one' AND revision = 1",
      )
      .run()
    const missing = await broken.preview()
    expect(
      Number(
        (
          await broken.adopt("assignment:missing", {
            ...broken.input,
            snapshotDigest: missing.snapshotDigest,
          })
        ).status,
      ),
    ).toBe(422)
  })

  test("公開上長と重複する既存の所属履歴を接続せず、保存済みの情報を変更しない", async () => {
    const overlapping = await fixture()
    expect(
      Number(
        (
          await overlapping.write(
            [
              {
                organizationId: "organization:default",
                type: "reporting-relation",
                id: "reporting:existing",
                revision: 1,
                state: "active",
                effectiveFrom: "2030-02-01",
                effectiveTo: "2030-03-01",
                attributes: {
                  employeeId: overlapping.people[0]!.employeeId,
                  managerEmployeeId: overlapping.people[1]!.employeeId,
                  organizationUnitId: "unit:adoption",
                },
              },
            ],
            await overlapping.companyRevision(),
            "assignment:existing-relation",
          )
        ).status,
      ),
    ).toBe(201)
    const current = await overlapping.preview()
    const before = await overlapping.persisted()
    expect(
      Number(
        (
          await overlapping.adopt("assignment:overlap", {
            ...overlapping.input,
            expectedRevision: current.expectedRevision,
            snapshotDigest: current.snapshotDigest,
          })
        ).status,
      ),
    ).toBe(422)
    expect(await overlapping.persisted()).toEqual(before)
  })

  test("既存の所属履歴を接続しても将来予約の前の空白を埋めない", async () => {
    const future = await fixture("2030-07-01")
    expect(Number((await future.adopt()).status)).toBe(201)
    expect(await future.publicAssignments("2030-06-01")).toEqual([])
    expect(await future.publicReporting("2030-06-01")).toEqual([])
    expect(
      (await future.publicReporting("2030-07-01")).map((resource) =>
        resource.readText("managerEmployeeId"),
      ),
    ).toEqual([future.people[2]!.employeeId])
  })

  test("既に接続した新しい所属と同じ上長範囲へ過去だけを追加する", async () => {
    const f = await fixture()
    const changed = await f.personnel(
      {
        kind: "position_changed",
        employeeCode: "EMPLOYEE-001",
        eventOn: restoreCalendarDate("2030-06-01"),
        departmentCode: "ADOPT",
        assignmentType: "primary",
        positionTitle: "Lead",
        changeType: "promotion",
      },
      "assignment:connected-future",
    )
    if (changed instanceof Error) throw changed
    const prior = (await f.publicReporting("2030-06-01"))[0]!
    const preview = await f.preview()
    expect(
      Number(
        (
          await f.adopt("assignment:old-periods", {
            ...f.input,
            expectedRevision: preview.expectedRevision,
            snapshotDigest: preview.snapshotDigest,
          })
        ).status,
      ),
    ).toBe(201)
    for (const [date, index] of [
      ["2030-02-01", 1],
      ["2030-05-01", 2],
      ["2030-07-01", 2],
    ] satisfies Array<[string, number]>) {
      const relations = await f.publicReporting(date)
      expect(relations).toHaveLength(1)
      expect(relations[0]!.id).toBe(prior.id)
      expect(relations[0]!.readText("managerEmployeeId")).toBe(f.people[index]!.employeeId)
    }
    expect(
      await f.database
        .prepare(
          "SELECT recorded_by_action_id, recorded_by_adoption_id FROM company_personnel_reporting_bindings",
        )
        .first<{ recorded_by_action_id: string | null; recorded_by_adoption_id: string | null }>(),
    ).toEqual({ recorded_by_action_id: changed.action.id, recorded_by_adoption_id: null })
  })

  test("参照・移行・成功済み再送は既定organizationのCompany管理者だけに許可する", async () => {
    const f = await fixture()
    expect(Number((await f.adopt()).status)).toBe(201)
    for (const actor of [
      undefined,
      CompanyActorValue.restore({
        ...f.creator,
        organizationIds: ["organization:default"],
        capabilities: ["company:read"],
      }),
      CompanyActorValue.restore({
        ...f.creator,
        organizationIds: ["organization:other"],
        capabilities: ["company:admin"],
      }),
    ]) {
      f.setActor(actor)
      const expected = actor === undefined ? 401 : 403
      expect(
        Number(
          (
            await f.client["assignment-adoptions"].$get({
              query: { employee_id: f.people[0]!.employeeId },
            })
          ).status,
        ),
      ).toBe(expected)
      expect(Number((await f.adopt()).status)).toBe(expected)
    }
  })
})
