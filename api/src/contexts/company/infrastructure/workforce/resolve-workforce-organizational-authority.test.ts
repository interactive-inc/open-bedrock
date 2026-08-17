import { OrganizationalAuthorityError } from "@/contexts/company/domain/workforce/organizational-authority-error"
import {
  resolveWorkforceOrganizationalAuthority,
  type WorkforceAuthorityAccountRow,
  type WorkforceAuthorityEmployeeRow,
  type WorkforceAuthorityOrganizationProjection,
} from "@/contexts/company/infrastructure/workforce/resolve-workforce-organizational-authority"
import { describe, expect, test } from "bun:test"
import { zAccountId } from "@system/domain/auth/account-id"

const employeeRows: ReadonlyArray<WorkforceAuthorityEmployeeRow> = [
  { id: 1, code: "M", status: "active", archivedAt: null },
  { id: 2, code: "S", status: "active", archivedAt: null },
  { id: 3, code: "D", status: "active", archivedAt: null },
  { id: 4, code: "T", status: "active", archivedAt: null },
]

const organization: WorkforceAuthorityOrganizationProjection = {
  memberships: [
    {
      employeeCode: "S",
      departmentCode: "A",
      managerEmployeeCode: "M",
      evidence: { type: "membership", storage_id: 21 },
    },
  ],
  departments: [
    {
      code: "A",
      managerEmployeeCode: "D",
      evidence: { type: "responsibility", storage_id: 31 },
    },
    {
      code: "B",
      managerEmployeeCode: "T",
      evidence: { type: "responsibility", storage_id: 32 },
    },
  ],
  liveEmployeeIds: new Set([1, 2, 3, 4]),
  organizationRevision: null,
}

const accountRows: ReadonlyArray<WorkforceAuthorityAccountRow> = employeeRows.map((employee) => ({
  legacyId: employee.id + 10,
  systemId: zAccountId.parse(String(employee.id + 10)),
  employeeId: employee.id,
}))

function baseProps() {
  return {
    snapshot: {
      schemaVersion: 1 as const,
      source: "legacy" as const,
      asOf: "2026-06-01",
      organizationRevision: null,
    },
    criteria: [],
    employeeRows,
    organization,
    accountRows,
    subjectEmployeeId: 2,
    targetDepartmentCode: "B",
  }
}

describe("resolveWorkforceOrganizationalAuthority", () => {
  test("uses the common resolver for every canonical criterion and preserves legacy evidence", () => {
    const result = resolveWorkforceOrganizationalAuthority({
      ...baseProps(),
      criteria: [
        { kind: "legacy_account_role", roleKey: "compatibility" },
        { kind: "direct_manager" },
        { kind: "department_manager" },
        { kind: "target_department_manager" },
        { kind: "management_chain" },
        { kind: "employee", employeeCode: "D" },
      ],
    })

    expect(result).toEqual({
      snapshot: baseProps().snapshot,
      candidates: [
        {
          employeeId: 1,
          accountId: zAccountId.parse("11"),
          qualification: {
            criterionIndex: 1,
            evidence: { type: "membership", storage_id: 21, system_account_id: "11" },
          },
        },
        {
          employeeId: 3,
          accountId: zAccountId.parse("13"),
          qualification: {
            criterionIndex: 2,
            evidence: { type: "responsibility", storage_id: 31, system_account_id: "13" },
          },
        },
        {
          employeeId: 4,
          accountId: zAccountId.parse("14"),
          qualification: {
            criterionIndex: 3,
            evidence: { type: "responsibility", storage_id: 32, system_account_id: "14" },
          },
        },
        {
          employeeId: 1,
          accountId: zAccountId.parse("11"),
          qualification: {
            criterionIndex: 4,
            evidence: {
              type: "management_chain",
              path: [{ type: "membership", storage_id: 21 }],
              system_account_id: "11",
            },
          },
        },
        {
          employeeId: 3,
          accountId: zAccountId.parse("13"),
          qualification: {
            criterionIndex: 5,
            evidence: { type: "employee_code", employee_code: "D", system_account_id: "13" },
          },
        },
      ],
    })
  })

  test("preserves distinct indexes when the same criterion object is reused", () => {
    const repeatedCriterion = { kind: "employee", employeeCode: "D" } as const
    const result = resolveWorkforceOrganizationalAuthority({
      ...baseProps(),
      criteria: [repeatedCriterion, repeatedCriterion],
    })

    expect(result).toMatchObject({
      candidates: [
        { qualification: { criterionIndex: 0 } },
        { qualification: { criterionIndex: 1 } },
      ],
    })
  })

  test("fails closed on dangling organization rows and duplicate Employee codes", () => {
    const dangling = resolveWorkforceOrganizationalAuthority({
      ...baseProps(),
      organization: {
        ...organization,
        memberships: [
          ...organization.memberships,
          {
            employeeCode: "UNKNOWN",
            departmentCode: "A",
            managerEmployeeCode: "M",
            evidence: {},
          },
        ],
      },
    })
    const duplicateCode = resolveWorkforceOrganizationalAuthority({
      ...baseProps(),
      employeeRows: [...employeeRows, { ...employeeRows[0]!, id: 5 }],
    })

    expect(dangling).toBeInstanceOf(OrganizationalAuthorityError)
    expect(dangling).toMatchObject({
      code: "organizational_authority_employee_reference_missing",
    })
    expect(duplicateCode).toBeInstanceOf(OrganizationalAuthorityError)
    expect(duplicateCode).toMatchObject({ code: "organizational_authority_employee_duplicate" })
  })
})
