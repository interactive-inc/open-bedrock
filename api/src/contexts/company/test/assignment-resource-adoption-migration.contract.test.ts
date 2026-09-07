import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"

describe("所属移行の上長対応を追加するmigration", () => {
  test("既存発令の上長対応とrowidを保持し、更新禁止と通常の上長変更が移行後も働く", async () => {
    const files = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .sort()
    const first = files.find((file) =>
      file.endsWith("_record_company_assignment_resource_adoptions.sql"),
    )
    if (first === undefined) throw new Error("missing assignment adoption migration")
    const database = createCompanyD1TestDatabase(
      files
        .filter((file) => file < first)
        .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
        .join("\n"),
    )
    // 旧schemaのfixtureを現行readerで準備する間だけ、当時の対応表を投影する。
    // Account履歴のmigrationに達したら破棄し、実際のviewへ置き換える。
    await database.exec(`CREATE VIEW company_account_employee_link_periods AS
      SELECT account_id, employee_id, NULL AS starts_on, NULL AS ends_on FROM company_account_employee_links`)
    const f = await createCompanyAssignmentResourceTestContext(database)
    await f.initializeAssignment()
    await f.assignEmployeeCode(f.people[1]!.employeeId, "MANAGER-001")
    await f.assignEmployeeCode(f.people[2]!.employeeId, "MANAGER-002")
    const changed = await f.personnel(
      {
        kind: "manager_changed",
        eventOn: restoreCalendarDate("2030-02-01"),
        employeeCode: "EMPLOYEE-001",
        departmentCode: "TEAM",
        assignmentType: "primary",
        managerEmployeeCode: "MANAGER-001",
      },
      "manager:before-migration",
    )
    expect(changed).toMatchObject({ replayed: false })
    const before = (
      await database
        .prepare("SELECT rowid, * FROM company_personnel_reporting_bindings ORDER BY rowid")
        .all()
    ).results
    expect(before).toHaveLength(1)
    const history = await f.publicReporting("2030-03-01")
    for (const file of files.filter((file) => file >= first)) {
      if (file.endsWith("_create_company_account_employee_link_periods.sql"))
        await database.exec("DROP VIEW company_account_employee_link_periods")
      await database.batch(
        splitSqlStatements(readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8")).map(
          (sql) => database.prepare(sql),
        ),
      )
    }
    expect(
      (
        await database
          .prepare(`SELECT rowid, resource_id, organization_id, resource_type, employee_id,
            employment_id, organization_unit_id, assignment_type, recorded_by_action_id,
            recorded_by_adoption_id FROM company_personnel_reporting_bindings ORDER BY rowid`)
          .all()
      ).results,
    ).toEqual(before.map((row) => ({ ...row, recorded_by_adoption_id: null })))
    expect(await f.publicReporting("2030-03-01")).toEqual(history)
    for (const sql of [
      "UPDATE company_personnel_reporting_bindings SET recorded_by_action_id = NULL",
      "DELETE FROM company_personnel_reporting_bindings",
    ]) {
      const failure = await database
        .prepare(sql)
        .run()
        .catch((cause: unknown) => cause)
      expect(failure).toBeInstanceOf(Error)
      if (!(failure instanceof Error)) throw new Error("missing immutable reporting binding guard")
      expect(failure.message).toContain("immutable")
    }
    const next = await f.personnel(
      {
        kind: "manager_changed",
        eventOn: restoreCalendarDate("2030-04-01"),
        employeeCode: "EMPLOYEE-001",
        departmentCode: "TEAM",
        assignmentType: "primary",
        managerEmployeeCode: "MANAGER-002",
      },
      "manager:after-migration",
    )
    expect(next).toMatchObject({ replayed: false })
    expect((await f.publicReporting("2030-04-01"))[0]?.attributes.managerEmployeeId).toBe(
      f.people[2]!.employeeId,
    )
    expect((await database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
  })
})
