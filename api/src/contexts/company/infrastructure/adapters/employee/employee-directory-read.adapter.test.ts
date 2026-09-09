import { drizzle } from "drizzle-orm/d1"
import { employments } from "@/contexts/company/infrastructure/schema/employment"
import { alias } from "drizzle-orm/sqlite-core"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { describe, expect, test, spyOn } from "bun:test"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { createEmployeeEmploymentTestDatabase } from "@/contexts/company/infrastructure/adapters/employee/lib/create-employee-employment-test-database.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

function directory(database: D1Database, now: string) {
  return new CompanyEmployeeDirectoryReadAdapter({
    env: { DB: database, NOW: now, COMPANY_TIME_ZONE: "Asia/Tokyo" },
  })
}

const page = {
  query: null,
  organizationUnit: null,
  status: null,
  limit: 10,
  offset: 0,
}

function employmentStatuses(database: D1Database, now: string) {
  const selected = alias(employments, "selected_employment")
  return drizzle(database)
    .select({
      id: selected.id,
      status: CompanyEmployeeDirectoryReadAdapter.employmentStatus({
        now,
        timeZone: "Asia/Tokyo",
        employmentId: selected.id,
        employeeId: selected.employeeId,
      }),
    })
    .from(selected)
    .orderBy(selected.id)
}

describe("雇用IDごとの有効な在籍状態", () => {
  test("退職予約を現在値から読まず、退職日の翌日に状態を切り替える", async () => {
    const database = createEmployeeEmploymentTestDatabase()
    expect(await employmentStatuses(database, "2026-09-30T14:59:59Z")).toEqual([
      { id: "employment:1", status: "ACTIVE" },
    ])
    expect(await employmentStatuses(database, "2026-09-30T15:00:00Z")).toEqual([
      { id: "employment:1", status: "TERMINATED" },
    ])
    expect(await employmentStatuses(database, "2025-12-31T00:00:00Z")).toEqual([
      { id: "employment:1", status: null },
    ])
  })

  test("将来の休職も開始日に切り替え、訂正された状態期間を優先する", async () => {
    const database = createEmployeeEmploymentTestDatabase(`
      UPDATE company_employments SET status = 'ON_LEAVE';
      INSERT INTO company_employee_status_period_versions VALUES
        ('status:1', 2, 'employment:1', 'employee:1', 'active', '2026-01-01', '2026-09-01', 0),
        ('status:leave', 1, 'employment:1', 'employee:1', 'leave', '2026-09-01', '2026-10-01', 0);
    `)
    expect(await employmentStatuses(database, "2026-08-31T14:59:59Z")).toEqual([
      { id: "employment:1", status: "ACTIVE" },
    ])
    expect(await employmentStatuses(database, "2026-08-31T15:00:00Z")).toEqual([
      { id: "employment:1", status: "ON_LEAVE" },
    ])
  })

  test("再入社予約と終了済み契約を取り違えず、別従業員の雇用も混ぜない", async () => {
    const database = createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_employees VALUES ('employee:2', 'Another Person', 'E002', NULL, NULL);
      INSERT INTO company_employments VALUES ('employment:2', 'employee:2', 'ACTIVE', '2026-01-01', NULL), ('employment:rehire', 'employee:1', 'ACTIVE', '2026-12-01', NULL);
      INSERT INTO company_employment_period_versions VALUES ('employment:2', 1, 'employee:2', '2026-01-01', NULL, 0), ('employment:rehire', 1, 'employee:1', '2026-12-01', NULL, 0);
      INSERT INTO company_employee_status_period_versions VALUES ('status:2', 1, 'employment:2', 'employee:2', 'leave', '2026-01-01', NULL, 0), ('status:rehire', 1, 'employment:rehire', 'employee:1', 'active', '2026-12-01', NULL, 0);
    `)
    expect(await employmentStatuses(database, "2026-11-01T00:00:00Z")).toEqual([
      { id: "employment:1", status: "TERMINATED" },
      { id: "employment:2", status: "ON_LEAVE" },
      { id: "employment:rehire", status: null },
    ])
    expect(await employmentStatuses(database, "2026-12-01T00:00:00Z")).toEqual([
      { id: "employment:1", status: "TERMINATED" },
      { id: "employment:2", status: "ON_LEAVE" },
      { id: "employment:rehire", status: "ACTIVE" },
    ])
  })

  test("履歴欠落・状態重複・期間外・取消は表示用statusで補わない", async () => {
    for (const additional of [
      "DELETE FROM company_employment_period_versions;",
      "DELETE FROM company_employee_status_period_versions;",
      "INSERT INTO company_employee_status_period_versions VALUES ('status:overlap', 1, 'employment:1', 'employee:1', 'active', '2026-01-01', '2026-10-01', 0);",
      "UPDATE company_employee_status_period_versions SET starts_on = '2025-01-01';",
      "INSERT INTO company_employment_period_versions VALUES ('employment:1', 2, 'employee:1', '2026-01-01', '2026-10-01', 1);",
    ]) {
      const database = createEmployeeEmploymentTestDatabase(additional)
      expect(await employmentStatuses(database, "2026-08-01T00:00:00Z")).toEqual([
        { id: "employment:1", status: null },
      ])
    }
  })

  test("雇用期間の重複では対象の契約を任意に選ばない", async () => {
    const database = createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_employments VALUES ('employment:other', 'employee:1', 'ACTIVE', '2026-01-01', NULL);
      INSERT INTO company_employment_period_versions VALUES ('employment:other', 1, 'employee:1', '2026-01-01', NULL, 0);
      INSERT INTO company_employee_status_period_versions VALUES ('status:other', 1, 'employment:other', 'employee:1', 'active', '2026-01-01', NULL, 0);
    `)
    expect(await employmentStatuses(database, "2026-08-01T00:00:00Z")).toEqual([
      { id: "employment:1", status: null },
      { id: "employment:other", status: null },
    ])
  })
})

describe("Company directoryの在籍時点", () => {
  test("Employee IDの一括参照は重複を除き、100件を超えても指定した基準日を使う", async () => {
    const database = createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_employees VALUES ('employee:200', 'Another Person', NULL, NULL, NULL);
    `)
    const employeeId = restoreWorkforceId("employee", "employee:1")
    const ids = Array.from({ length: 201 }, (_, index) =>
      restoreWorkforceId("employee", `employee:${index}`),
    )
    const result = await new CompanyEmployeeDirectoryReadAdapter({
      env: { DB: database, NOW: "2026-12-01T00:00:00Z", COMPANY_TIME_ZONE: "Asia/Tokyo" },
      asOf: restoreCalendarDate("2026-09-01"),
    }).findForEmployeeIds([...ids, employeeId])
    expect(result).toMatchObject([
      { id: employeeId, employment: { status: "ACTIVE" } },
      { id: "employee:200", employment: null },
    ])
    expect(result).toHaveLength(2)
    expect(await directory(database, "2026-12-01T00:00:00Z").findForEmployeeIds([])).toEqual([])
  })

  test("Employee ID一括参照の一部が欠けた場合は成功分だけを返さない", async () => {
    const database = createEmployeeEmploymentTestDatabase()
    const batch = database.batch.bind(database)
    const incomplete = spyOn(database, "batch").mockImplementation(
      async <T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> =>
        (await batch<T>(statements)).slice(0, -1),
    )
    try {
      const ids = Array.from({ length: 100 }, (_, index) =>
        restoreWorkforceId("employee", `employee:${index}`),
      )
      expect(
        await directory(database, "2026-09-01T00:00:00Z").findForEmployeeIds(ids),
      ).toBeInstanceOf(Error)
    } finally {
      incomplete.mockRestore()
    }
  })

  test("Accountの解決も同じ在籍と所属の終了境界を使う", async () => {
    const database = createEmployeeEmploymentTestDatabase(`
      CREATE TABLE company_account_employee_links (account_id TEXT, employee_id TEXT);
      CREATE VIEW company_account_employee_link_periods AS
        SELECT account_id, employee_id, NULL AS starts_on, NULL AS ends_on FROM company_account_employee_links;
      INSERT INTO company_account_employee_links VALUES ('account:1', 'employee:1');
      INSERT INTO company_organization_unit_period_versions VALUES
        ('unit-period:1', 1, 'unit:1', 'UNIT', 'Example Unit', '2026-01-01', '2026-10-01', 0);
      INSERT INTO company_organization_assignment_period_versions VALUES
        ('assignment:1', 1, 'employee:1', 'unit:1', 'PRIMARY', NULL, 'employment:1', '2026-01-01', '2026-10-01', 0);
    `)
    const accountId = zAccountId.parse("account:1")
    const before = await directory(database, "2026-09-30T14:59:59Z").findForAccountIds([
      accountId,
      accountId,
    ])
    expect(before).toMatchObject([
      {
        accountId,
        employee: {
          employment: { status: "ACTIVE" },
          primaryAssignment: { organizationUnitName: "Example Unit" },
        },
      },
    ])
    const after = await directory(database, "2026-09-30T15:00:00Z").findForAccountIds([accountId])
    expect(after).toMatchObject([
      {
        accountId,
        employee: {
          employment: { status: "TERMINATED" },
          primaryAssignment: null,
        },
      },
    ])
  })

  test("一つのAccountに複数の従業員がある場合は選ばずに拒否する", async () => {
    const database = createEmployeeEmploymentTestDatabase(`
      CREATE TABLE company_account_employee_links (account_id TEXT, employee_id TEXT);
      CREATE VIEW company_account_employee_link_periods AS
        SELECT account_id, employee_id, NULL AS starts_on, NULL AS ends_on FROM company_account_employee_links;
      INSERT INTO company_employees VALUES ('employee:2', 'Another Person', 'E002', NULL, NULL);
      INSERT INTO company_account_employee_links VALUES ('account:1', 'employee:1'), ('account:1', 'employee:2');
    `)
    expect(
      await directory(database, "2026-09-01T00:00:00Z").findForAccountIds([
        zAccountId.parse("account:1"),
      ]),
    ).toBeInstanceOf(Error)
  })

  test("100件を超えるAccountも分割し、未紐付けは候補に含めない", async () => {
    const database = createEmployeeEmploymentTestDatabase(`
      CREATE TABLE company_account_employee_links (account_id TEXT, employee_id TEXT);
      CREATE VIEW company_account_employee_link_periods AS
        SELECT account_id, employee_id, NULL AS starts_on, NULL AS ends_on FROM company_account_employee_links;
      INSERT INTO company_account_employee_links VALUES ('account:200', 'employee:1');
    `)
    const accountIds = Array.from({ length: 201 }, (_, index) =>
      zAccountId.parse(`account:${index}`),
    )
    expect(
      await directory(database, "2026-09-01T00:00:00Z").findForAccountIds(accountIds),
    ).toMatchObject([{ accountId: "account:200", employee: { employment: { status: "ACTIVE" } } }])
  })

  test("退職予約済みでも発効前は在籍し、発効後は退職と表示する", async () => {
    const database = createEmployeeEmploymentTestDatabase()
    expect(await directory(database, "2026-09-30T14:59:59Z").findByCode("E001")).toMatchObject({
      employment: { id: "employment:1", status: "ACTIVE" },
    })
    expect(await directory(database, "2026-09-30T15:00:00Z").findByCode("E001")).toMatchObject({
      employment: { id: "employment:1", status: "TERMINATED" },
    })
  })

  test("一覧の状態フィルタと件数も期間履歴に一致する", async () => {
    const database = createEmployeeEmploymentTestDatabase()
    const reader = directory(database, "2026-09-01T00:00:00Z")
    expect(await reader.list({ ...page, status: "active" })).toMatchObject({
      total: 1,
      employees: [{ id: "employee:1", employment: { status: "ACTIVE" } }],
    })
    expect(await reader.list({ ...page, status: "retired" })).toEqual({ total: 0, employees: [] })
  })

  test("将来の再雇用予約を現在の雇用として表示しない", async () => {
    const database = createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_employments VALUES
        ('employment:rehire', 'employee:1', 'ACTIVE', '2026-12-01', NULL);
      INSERT INTO company_employment_period_versions VALUES
        ('employment:rehire', 1, 'employee:1', '2026-12-01', NULL, 0);
      INSERT INTO company_employee_status_period_versions VALUES
        ('status:rehire', 1, 'employment:rehire', 'employee:1', 'active', '2026-12-01', NULL, 0);
    `)
    expect(await directory(database, "2026-10-01T00:00:00Z").findByCode("E001")).toMatchObject({
      employment: { id: "employment:1", status: "TERMINATED" },
    })
    expect(await directory(database, "2026-12-01T00:00:00Z").findByCode("E001")).toMatchObject({
      employment: { id: "employment:rehire", status: "ACTIVE" },
    })
  })

  test("初回入社前の人を在籍中として表示しない", async () => {
    const database = createEmployeeEmploymentTestDatabase()
    expect(await directory(database, "2025-12-31T00:00:00Z").findByCode("E001")).toMatchObject({
      employment: null,
    })
  })

  test("最新訂正で取り消した雇用を表示用tableから復活させない", async () => {
    const database = createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_employment_period_versions VALUES
        ('employment:1', 2, 'employee:1', '2026-01-01', '2026-10-01', 1);
    `)
    expect(await directory(database, "2026-09-01T00:00:00Z").findByCode("E001")).toMatchObject({
      employment: null,
    })
  })

  test("雇用中の状態が欠落した場合は一覧と単体の両方をエラーにする", async () => {
    const database = createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_employee_status_period_versions VALUES
        ('status:1', 2, 'employment:1', 'employee:1', 'active', '2026-01-01', '2026-10-01', 1);
    `)
    const reader = directory(database, "2026-09-01T00:00:00Z")
    expect(await reader.findByCode("E001")).toBeInstanceOf(Error)
    expect(await reader.list({ ...page, status: "active" })).toBeInstanceOf(Error)
  })

  test("重複する雇用状態を一件に丸めずエラーにする", async () => {
    const database = createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_employee_status_period_versions VALUES
        ('status:duplicate', 1, 'employment:1', 'employee:1', 'leave', '2026-07-01', '2026-10-01', 0);
    `)
    const reader = directory(database, "2026-09-01T00:00:00Z")
    expect(await reader.findByCode("E001")).toBeInstanceOf(Error)
    expect(await reader.list(page)).toBeInstanceOf(Error)
  })

  test("主務が重複する場合は先頭の所属だけを返さない", async () => {
    const database = createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_organization_unit_period_versions VALUES
        ('unit-period:1', 1, 'unit:1', 'UNIT', 'Example Unit', '2026-01-01', NULL, 0);
      INSERT INTO company_organization_assignment_period_versions VALUES
        ('assignment:1', 1, 'employee:1', 'unit:1', 'PRIMARY', NULL, 'employment:1', '2026-01-01', NULL, 0),
        ('assignment:2', 1, 'employee:1', 'unit:1', 'PRIMARY', NULL, 'employment:1', '2026-01-01', NULL, 0);
    `)
    const reader = directory(database, "2026-09-01T00:00:00Z")
    expect(await reader.findByCode("E001")).toBeInstanceOf(Error)
    expect(await reader.list(page)).toBeInstanceOf(Error)
  })
})

function employeeNamesReader(
  props: Omit<Parameters<typeof CompanyEmployeeDirectoryReadAdapter.findNames>[0], "employeeIds">,
) {
  return {
    findForEmployeeIds: (
      employeeIds: ReadonlyArray<ReturnType<typeof restoreWorkforceId<"employee">>>,
    ) => CompanyEmployeeDirectoryReadAdapter.findNames({ ...props, employeeIds }),
  }
}

const employeeId = restoreWorkforceId("employee", "employee:1")
const history = `
  UPDATE company_employees SET official_name = 'Future Person';
  INSERT INTO company_workforce_resource_bindings VALUES
    ('employee', 'employee:1', 'organization:default', 'employee:1');
  INSERT INTO company_resource_revisions VALUES
    ('organization:default', 'employee', 'employee:1', 1, 'active', '2026-01-01', NULL, '{"personId":"person:1"}'),
    ('organization:default', 'person', 'person:1', 1, 'active', '2026-01-01', NULL, '{"officialName":"Current Person"}'),
    ('organization:default', 'person', 'person:1', 2, 'active', '2026-07-01', NULL, '{"officialName":"Future Person"}');
`

describe("Company従業員名の期間参照", () => {
  test("D1とDrizzleで同じ会社営業日に切り替え、同日の訂正を優先する", async () => {
    const database = createEmployeeEmploymentTestDatabase(
      history +
        `
      INSERT INTO company_resource_revisions VALUES
        ('organization:default', 'person', 'person:1', 3, 'active', '2026-07-01', NULL, '{"officialName":"Corrected Person"}');
    `,
    )
    for (const source of [database, drizzle(database)]) {
      for (const instant of ["2026-06-30T14:59:59Z", "2026-06-30T15:00:00Z"]) {
        const names = await employeeNamesReader({
          database: source,
          now: instant,
          timeZone: "Asia/Tokyo",
        }).findForEmployeeIds([employeeId, employeeId])
        if (names instanceof Error) throw names
        expect(names.size).toBe(1)
        expect(names.get(employeeId)).toBe(
          instant.endsWith("14:59:59Z") ? "Current Person" : "Corrected Person",
        )
      }
    }
    expect(
      await database
        .prepare("SELECT official_name FROM company_employees")
        .first<string>("official_name"),
    ).toBe("Future Person")
    expect(
      await database
        .prepare("SELECT count(*) AS total FROM company_resource_revisions")
        .first<number>("total"),
    ).toBe(4)
  })

  test("接続済みの開始前・期間終了・人物取消では旧氏名へ戻さない", async () => {
    for (const suffix of [
      "UPDATE company_resource_revisions SET effective_to = '2026-07-01' WHERE resource_type = 'employee';",
      "UPDATE company_resource_revisions SET state = 'cancelled' WHERE resource_type = 'person' AND revision = 2;",
      "DELETE FROM company_resource_revisions WHERE resource_type = 'person';",
    ]) {
      const database = createEmployeeEmploymentTestDatabase(history + suffix)
      for (const now of ["2025-12-31T00:00:00Z", "2026-07-01T00:00:00Z"]) {
        const names = await employeeNamesReader({
          database,
          now,
          timeZone: "Asia/Tokyo",
        }).findForEmployeeIds([employeeId])
        expect(names).toEqual(new Map())
      }
    }
  })

  test("未接続の従業員名を保ち、201件・重複・存在しないIDを一括参照する", async () => {
    const database = createEmployeeEmploymentTestDatabase()
    const ids = Array.from({ length: 201 }, (_, index) =>
      restoreWorkforceId("employee", `employee:${index}`),
    )
    const names = await employeeNamesReader({
      database,
      now: "2026-07-01T00:00:00Z",
      timeZone: "Asia/Tokyo",
    }).findForEmployeeIds([...ids, employeeId])
    expect(names).toEqual(new Map([[employeeId, "Example Person"]]))
  })

  test("空の参照はDB・時計を使用せず、非空なら不明なtimezoneを拒否する", async () => {
    const database = createEmployeeEmploymentTestDatabase()
    const prepare = spyOn(database, "prepare")
    try {
      for (const timeZone of [undefined, "Invalid/Zone"]) {
        const repository = employeeNamesReader({
          database,
          now: "2026-07-01T00:00:00Z",
          timeZone,
        })
        expect(await repository.findForEmployeeIds([])).toEqual(new Map())
        expect(await repository.findForEmployeeIds([employeeId])).toBeInstanceOf(Error)
      }
      expect(prepare).not.toHaveBeenCalled()
    } finally {
      prepare.mockRestore()
    }
  })

  test("同じ従業員への重複した公開対応は一つを選ばず拒否する", async () => {
    const database = createEmployeeEmploymentTestDatabase(
      history +
        `
      INSERT INTO company_workforce_resource_bindings VALUES
        ('employee', 'employee:1', 'organization:default', 'employee:1');
    `,
    )
    expect(
      await employeeNamesReader({
        database,
        now: "2026-07-01T00:00:00Z",
        timeZone: "Asia/Tokyo",
      }).findForEmployeeIds([employeeId]),
    ).toBeInstanceOf(Error)
  })

  test("壊れた氏名とDB障害では部分結果を返さない", async () => {
    const database = createEmployeeEmploymentTestDatabase(
      "UPDATE company_employees SET official_name = '';",
    )
    const repository = employeeNamesReader({
      database,
      now: "2026-07-01T00:00:00Z",
      timeZone: "Asia/Tokyo",
    })
    expect(await repository.findForEmployeeIds([employeeId])).toBeInstanceOf(Error)
    const outage = spyOn(database, "prepare").mockImplementation(() => {
      throw new Error("Database unavailable")
    })
    try {
      expect(await repository.findForEmployeeIds([employeeId])).toBeInstanceOf(Error)
    } finally {
      outage.mockRestore()
    }
  })
})
