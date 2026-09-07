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
