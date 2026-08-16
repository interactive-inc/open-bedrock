import { afterEach, describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"

const migration = await Bun.file(
  new URL("../../../../../migrations/0137_remove_grade_review_link.sql", import.meta.url),
).text()

const databases: Array<Database> = []

function createDatabase(): Database {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE employee_grades (
      id INTEGER PRIMARY KEY,
      employee_id INTEGER NOT NULL,
      grade_id INTEGER NOT NULL,
      effective_date TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL,
      review_cycle_id INTEGER
    );
  `)
  databases.push(database)
  return database
}

afterEach(() => {
  for (const database of databases.splice(0)) database.close()
})

describe("0137 Company grade and Performance Review separation", () => {
  test("removes only the cross-context link and preserves grade history", () => {
    const database = createDatabase()
    database.run(
      `INSERT INTO employee_grades
         (id, employee_id, grade_id, effective_date, reason, created_at, review_cycle_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [1, 20, 3, "2026-04-01", "promotion", "2026-03-01T00:00:00Z", 9],
    )

    database.exec(migration)

    const columns = database
      .query<{ name: string }, []>("SELECT name FROM pragma_table_info('employee_grades')")
      .all()
      .map((column) => column.name)
    expect(columns).toEqual([
      "id",
      "employee_id",
      "grade_id",
      "effective_date",
      "reason",
      "created_at",
    ])
    expect(
      database
        .query<
          {
            id: number
            employeeId: number
            gradeId: number
            effectiveDate: string
            reason: string | null
            createdAt: string
          },
          []
        >(
          `SELECT
             id,
             employee_id AS employeeId,
             grade_id AS gradeId,
             effective_date AS effectiveDate,
             reason,
             created_at AS createdAt
           FROM employee_grades`,
        )
        .get(),
    ).toEqual({
      id: 1,
      employeeId: 20,
      gradeId: 3,
      effectiveDate: "2026-04-01",
      reason: "promotion",
      createdAt: "2026-03-01T00:00:00Z",
    })
  })
})
