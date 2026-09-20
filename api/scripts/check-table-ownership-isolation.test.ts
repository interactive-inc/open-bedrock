import {
  canOwnerReference,
  canSourceQueryOwner,
  collectTableOwnershipViolations,
  inspectTableReferences,
  resolveTableOwner,
} from "./check-table-ownership-isolation"
import { describe, expect, test } from "bun:test"

const owners = new Map([
  ["system_accounts", "system"],
  ["company_employees", "company"],
  ["leave_requests", "leave"],
  ["attendance_records", "attendance"],
])

describe("table の所有境界", () => {
  test("依存方向は 業務 -> company -> system だけを許可する", () => {
    expect(canOwnerReference("leave", "leave")).toBe(true)
    expect(canOwnerReference("leave", "company")).toBe(true)
    expect(canOwnerReference("leave", "system")).toBe(true)
    expect(canOwnerReference("company", "system")).toBe(true)
    expect(canOwnerReference("leave", "attendance")).toBe(false)
    expect(canOwnerReference("company", "leave")).toBe(false)
    expect(canOwnerReference("system", "leave")).toBe(false)
    expect(canOwnerReference("system", "company")).toBe(false)
  })

  test("宣言のない table は最長の context 接頭辞で所有者を決め、決定不能は null にする", () => {
    const contexts = ["leave", "family-care-leave", "software-license"]
    const declared = new Map([["holidays", "leave"]])

    expect(resolveTableOwner("holidays", declared, contexts)).toBe("leave")
    expect(resolveTableOwner("software_license_changes", declared, contexts)).toBe(
      "software-license",
    )
    expect(resolveTableOwner("family_care_leave_requests", declared, contexts)).toBe(
      "family-care-leave",
    )
    expect(resolveTableOwner("orphans", declared, contexts)).toBeNull()
  })

  test("別の業務の table を結合する SQL を検出する", () => {
    const source = `
      db.prepare(\`
        SELECT l.id FROM leave_requests l
        JOIN attendance_records a ON a.employee_id = l.employee_id
      \`)
    `

    expect(inspectTableReferences("src/example.ts", "leave", source, owners)).toEqual([
      {
        file: "src/example.ts",
        reason: "leave が attendance の table を SQL で直接参照しています: attendance_records",
      },
    ])
  })

  test("基盤から業務、system から company への参照を検出する", () => {
    expect(
      inspectTableReferences(
        "src/example.ts",
        "company",
        'db.prepare("UPDATE leave_requests SET status = ?1")',
        owners,
      ),
    ).toHaveLength(1)
    expect(
      inspectTableReferences(
        "src/example.ts",
        "system",
        'db.prepare("INSERT INTO company_employees (id) VALUES (?1)")',
        owners,
      ),
    ).toHaveLength(1)
  })

  test("自分の table と System の table への参照は許可する", () => {
    const source =
      "db.prepare(`SELECT 1 FROM leave_requests l JOIN system_accounts a ON a.id = ?1`)"

    expect(inspectTableReferences("src/example.ts", "leave", source, owners)).toEqual([])
  })

  test("業務から Company の table への SQL 参照を拒否し、Company 自身の参照は許可する", () => {
    const source = "db.prepare(`SELECT 1 FROM company_employees WHERE id = ?1`)"

    expect(inspectTableReferences("src/example.ts", "leave", source, owners)).toEqual([
      {
        file: "src/example.ts",
        reason: "leave が company の table を SQL で直接参照しています: company_employees",
      },
    ])
    expect(inspectTableReferences("src/example.ts", "company", source, owners)).toEqual([])
    expect(canSourceQueryOwner("src/example.ts", "leave", "system")).toBe(true)
  })

  test("API composition は業務と System の table を読めるが、Company の table は読めない", () => {
    expect(canSourceQueryOwner("src/api/http/example.ts", "api-composition", "leave")).toBe(true)
    expect(canSourceQueryOwner("src/api/http/example.ts", "api-composition", "system")).toBe(true)
    expect(canSourceQueryOwner("src/api/http/example.ts", "api-composition", "company")).toBe(false)
    expect(
      inspectTableReferences(
        "src/api/http/example.ts",
        "api-composition",
        'db.prepare("SELECT 1 FROM company_employees")',
        owners,
      ),
    ).toHaveLength(1)
  })

  test("現在の migration と production source に違反がない", async () => {
    expect(await collectTableOwnershipViolations()).toEqual([])
  })
})
