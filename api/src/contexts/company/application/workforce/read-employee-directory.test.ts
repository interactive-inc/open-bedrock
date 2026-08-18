import {
  employeeDirectoryBatchLimit,
  ReadEmployeeDirectory,
  type EmployeeDirectoryReadPort,
  type EmployeeDirectoryReadPortResult,
} from "@/contexts/company/application/workforce/read-employee-directory"
import type { Employee } from "@/contexts/company/domain/workforce/workforce-schedule"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/restore-workforce-id"
import { describe, expect, test } from "bun:test"

const firstEmployeeId = restoreWorkforceId("employee", "employee-1")
const secondEmployeeId = restoreWorkforceId("employee", "employee-2")
const unexpectedEmployeeId = restoreWorkforceId("employee", "employee-3")
const firstEmployee: Employee = {
  id: firstEmployeeId,
  officialName: "First Person",
  employeeCode: "E001",
  email: null,
  phone: null,
}
const secondEmployee: Employee = {
  id: secondEmployeeId,
  officialName: "Second Person",
  employeeCode: "E002",
  email: "second@example.com",
  phone: "+81-90-0000-0000",
}

class StubPort implements EmployeeDirectoryReadPort {
  readonly calls: Array<ReadonlyArray<string>> = []

  constructor(
    private readonly loaded: EmployeeDirectoryReadPortResult | Error,
    private readonly doesThrow = false,
  ) {}

  async findByEmployeeIds(
    employeeIds: ReadonlyArray<typeof firstEmployeeId>,
  ): Promise<EmployeeDirectoryReadPortResult> {
    this.calls.push([...employeeIds])
    if (this.doesThrow) throw this.loaded

    return this.loaded instanceof Error ? { ok: false, cause: this.loaded } : this.loaded
  }
}

describe("ReadEmployeeDirectory", () => {
  test("returns found profiles in requested order and omits missing IDs", async () => {
    const recordWithPrivateField = { ...firstEmployee, privateField: "must not escape" }
    const port = new StubPort({ ok: true, employees: [recordWithPrivateField, secondEmployee] })
    const resolution = await new ReadEmployeeDirectory({ port }).execute([
      secondEmployeeId,
      unexpectedEmployeeId,
      firstEmployeeId,
    ])

    expect(resolution).toEqual({
      kind: "found",
      employees: [secondEmployee, firstEmployee],
      missingEmployeeIds: [unexpectedEmployeeId],
    })
    expect(port.calls).toEqual([[secondEmployeeId, unexpectedEmployeeId, firstEmployeeId]])
  })

  test("returns an empty directory without reading storage", async () => {
    const port = new StubPort(new Error("must not read"), true)

    expect(await new ReadEmployeeDirectory({ port }).execute([])).toEqual({
      kind: "found",
      employees: [],
      missingEmployeeIds: [],
    })
    expect(port.calls).toHaveLength(0)
  })

  test.each([
    {
      employeeIds: [firstEmployeeId, firstEmployeeId],
      code: "employee_directory_query_duplicate",
    },
    {
      employeeIds: Array.from({ length: employeeDirectoryBatchLimit + 1 }, (_, index) =>
        restoreWorkforceId("employee", `employee-${index + 1}`),
      ),
      code: "employee_directory_query_too_large",
    },
  ])("rejects $code before reading storage", async (example) => {
    const port = new StubPort(new Error("must not read"), true)
    const resolution = await new ReadEmployeeDirectory({ port }).execute(example.employeeIds)

    expect(resolution).toEqual(
      expect.objectContaining({
        kind: "invalid_query",
        error: expect.objectContaining({ code: example.code }),
      }),
    )
    expect(port.calls).toHaveLength(0)
  })

  test.each([
    {
      employees: [firstEmployee, firstEmployee],
      code: "employee_directory_record_duplicate",
    },
    {
      employees: [{ ...firstEmployee, id: unexpectedEmployeeId }],
      code: "employee_directory_record_unexpected",
    },
    {
      employees: [{ ...firstEmployee, officialName: " First Person" }],
      code: "employee_directory_profile_invalid",
    },
    {
      employees: [firstEmployee, { ...secondEmployee, employeeCode: firstEmployee.employeeCode }],
      code: "employee_directory_code_duplicate",
    },
  ])("rejects $code from the directory port", async (example) => {
    const resolution = await new ReadEmployeeDirectory({
      port: new StubPort({ ok: true, employees: example.employees }),
    }).execute([firstEmployeeId, secondEmployeeId])

    expect(resolution).toEqual(
      expect.objectContaining({
        kind: "invalid_directory",
        error: expect.objectContaining({ code: example.code }),
      }),
    )
  })

  test.each([
    { loaded: { ok: false as const, cause: new Error("read failed") }, doesThrow: false },
    { loaded: new Error("port threw"), doesThrow: true },
  ])("returns unavailable when storage cannot be evaluated", async (example) => {
    const resolution = await new ReadEmployeeDirectory({
      port: new StubPort(example.loaded, example.doesThrow),
    }).execute([firstEmployeeId])

    expect(resolution.kind).toBe("unavailable")
  })
})
