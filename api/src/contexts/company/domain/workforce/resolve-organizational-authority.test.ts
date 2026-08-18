import { restoreCalendarDate } from "@/contexts/company/domain/workforce/restore-calendar-date"
import { OrganizationalAuthorityError } from "@/contexts/company/domain/workforce/organizational-authority-error"
import type {
  OrganizationalAuthorityCriterion,
  OrganizationalAuthorityProjection,
} from "@/contexts/company/domain/workforce/organizational-authority"
import { resolveOrganizationalAuthority } from "@/contexts/company/domain/workforce/resolve-organizational-authority"
import type { WorkforceStateAt } from "@/contexts/company/domain/workforce/resolve-workforce-state"
import type {
  AccountEmployeeLink,
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
} from "@/contexts/company/domain/workforce/workforce-schedule"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/restore-workforce-id"
import type {
  EmployeeId,
  OrganizationUnitId,
} from "@/contexts/company/domain/workforce/workforce-id"
import { describe, expect, test } from "bun:test"

const asOf = restoreCalendarDate("2026-06-01")
const startsOn = restoreCalendarDate("2026-01-01")
const subjectId = employeeId("employee-1")
const managerId = employeeId("employee-2")
const executiveId = employeeId("employee-3")
const organizationManagerId = employeeId("employee-4")
const inactiveId = employeeId("employee-5")
const productId = organizationUnitId("organization-product")
const financeId = organizationUnitId("organization-finance")

function employeeId(value: string): EmployeeId {
  return restoreWorkforceId("employee", value)
}

function organizationUnitId(value: string): OrganizationUnitId {
  return restoreWorkforceId("organization_unit", value)
}

function assignment(props: {
  employeeId: EmployeeId
  managerEmployeeId: EmployeeId | null
  organizationUnitId: OrganizationUnitId
  suffix?: string
  assignmentType?: "PRIMARY" | "CONCURRENT"
}): OrgAssignmentPeriod {
  const suffix = props.suffix ?? "primary"

  return {
    periodId: restoreWorkforceId("period", `assignment-${props.employeeId}-${suffix}`),
    revision: 3,
    startsOn,
    endsOn: null,
    isVoid: false,
    recordedByActionId: restoreWorkforceId("personnel_action", "action-fixture"),
    recordedAt: 1,
    employmentId: restoreWorkforceId("employment", `employment-${props.employeeId}`),
    employeeId: props.employeeId,
    organizationUnitId: props.organizationUnitId,
    assignmentType: props.assignmentType ?? "PRIMARY",
    positionTitle: null,
    managerEmployeeId: props.managerEmployeeId,
  }
}

function responsibility(props: {
  employeeId: EmployeeId
  organizationUnitId: OrganizationUnitId
  responsibilityType?: string
}): OrgResponsibilityPeriod {
  const responsibilityType = props.responsibilityType ?? "MANAGER"
  return {
    periodId: restoreWorkforceId(
      "period",
      `responsibility-${props.employeeId}-${props.organizationUnitId}-${responsibilityType}`,
    ),
    revision: 4,
    startsOn,
    endsOn: null,
    isVoid: false,
    recordedByActionId: restoreWorkforceId("personnel_action", "action-fixture"),
    recordedAt: 1,
    employmentId: restoreWorkforceId("employment", `employment-${props.employeeId}`),
    employeeId: props.employeeId,
    organizationUnitId: props.organizationUnitId,
    responsibilityType,
  }
}

function state(props: {
  employeeId: EmployeeId
  managerEmployeeId?: EmployeeId | null
  organizationUnitId?: OrganizationUnitId
  concurrentAssignments?: ReadonlyArray<OrgAssignmentPeriod>
  responsibilities?: ReadonlyArray<OrgResponsibilityPeriod>
  status?: "ACTIVE" | "ON_LEAVE" | "TERMINATED"
  stateAsOf?: WorkforceStateAt["asOf"]
}): WorkforceStateAt {
  const status = props.status ?? "ACTIVE"
  const employmentId =
    status === "TERMINATED"
      ? null
      : restoreWorkforceId("employment", `employment-${props.employeeId}`)
  const primaryAssignment =
    status === "TERMINATED" || props.organizationUnitId === undefined
      ? null
      : assignment({
          employeeId: props.employeeId,
          managerEmployeeId: props.managerEmployeeId ?? null,
          organizationUnitId: props.organizationUnitId,
        })

  return {
    employeeId: props.employeeId,
    asOf: props.stateAsOf ?? asOf,
    status,
    employmentId,
    primaryAssignment,
    concurrentAssignments: status === "TERMINATED" ? [] : (props.concurrentAssignments ?? []),
    responsibilities: status === "TERMINATED" ? [] : (props.responsibilities ?? []),
  }
}

function link(employee: EmployeeId, account: string = `account-${employee}`): AccountEmployeeLink {
  return {
    employeeId: employee,
    accountId: restoreWorkforceId("system_account", account),
  }
}

function baseProjection(
  overrides: Partial<OrganizationalAuthorityProjection> = {},
): OrganizationalAuthorityProjection {
  const states = [
    state({ employeeId: subjectId, managerEmployeeId: managerId, organizationUnitId: productId }),
    state({ employeeId: managerId, managerEmployeeId: executiveId, organizationUnitId: productId }),
    state({
      employeeId: executiveId,
      organizationUnitId: financeId,
      responsibilities: [
        responsibility({ employeeId: executiveId, organizationUnitId: financeId }),
        responsibility({
          employeeId: executiveId,
          organizationUnitId: financeId,
          responsibilityType: "PEOPLE_OPERATIONS",
        }),
      ],
    }),
    state({
      employeeId: organizationManagerId,
      organizationUnitId: productId,
      responsibilities: [
        responsibility({ employeeId: organizationManagerId, organizationUnitId: productId }),
      ],
    }),
    state({ employeeId: inactiveId, status: "TERMINATED" }),
  ]

  return {
    snapshot: {
      schemaVersion: 1,
      source: "lifecycle",
      asOf,
      organizationRevision: 7,
    },
    subjectEmployeeId: subjectId,
    criteria: [],
    states,
    accountLinks: states.map((item) => link(item.employeeId)),
    ...overrides,
  }
}

function expectError(
  projection: OrganizationalAuthorityProjection,
  code: OrganizationalAuthorityError["code"],
): void {
  const result = resolveOrganizationalAuthority(projection)

  expect(result).toBeInstanceOf(OrganizationalAuthorityError)
  expect(result).toMatchObject({ code })
}

describe("resolveOrganizationalAuthority", () => {
  test("resolves every canonical criterion in criterion and opaque ID order", () => {
    const criteria: ReadonlyArray<OrganizationalAuthorityCriterion> = [
      { kind: "direct_manager" },
      { kind: "subject_organization_manager" },
      { kind: "target_organization_manager", organizationUnitId: financeId },
      { kind: "management_chain" },
      {
        kind: "responsibility",
        responsibilityType: "PEOPLE_OPERATIONS",
        organizationUnitId: null,
      },
      { kind: "employee", employeeId: organizationManagerId },
    ]
    const result = resolveOrganizationalAuthority(baseProjection({ criteria }))

    expect(result).not.toBeInstanceOf(Error)
    expect(result).toMatchObject({
      snapshot: { source: "lifecycle", asOf, organizationRevision: 7 },
      candidates: [
        {
          employeeId: managerId,
          qualification: {
            criterionIndex: 0,
            evidence: {
              kind: "direct_manager",
              assignment: {
                employeeId: subjectId,
                managerEmployeeId: managerId,
                organizationUnitId: productId,
                assignmentRevision: 3,
                asOf,
              },
            },
          },
        },
        {
          employeeId: organizationManagerId,
          qualification: {
            criterionIndex: 1,
            evidence: {
              kind: "organization_manager",
              scope: "subject",
              responsibility: {
                employeeId: organizationManagerId,
                organizationUnitId: productId,
                responsibilityRevision: 4,
                asOf,
              },
            },
          },
        },
        {
          employeeId: executiveId,
          qualification: {
            criterionIndex: 2,
            evidence: { kind: "organization_manager", scope: "target" },
          },
        },
        {
          employeeId: managerId,
          qualification: {
            criterionIndex: 3,
            evidence: { kind: "management_chain", path: [{ managerEmployeeId: managerId }] },
          },
        },
        {
          employeeId: executiveId,
          qualification: {
            criterionIndex: 3,
            evidence: {
              kind: "management_chain",
              path: [{ managerEmployeeId: managerId }, { managerEmployeeId: executiveId }],
            },
          },
        },
        {
          employeeId: executiveId,
          qualification: {
            criterionIndex: 4,
            evidence: {
              kind: "responsibility",
              responsibility: {
                employeeId: executiveId,
                organizationUnitId: financeId,
                responsibilityType: "PEOPLE_OPERATIONS",
              },
            },
          },
        },
        {
          employeeId: organizationManagerId,
          qualification: { criterionIndex: 5, evidence: { kind: "employee" } },
        },
      ],
    })
  })

  test("keeps zero candidates distinct from an invalid projection", () => {
    const result = resolveOrganizationalAuthority(
      baseProjection({
        subjectEmployeeId: null,
        criteria: [
          { kind: "direct_manager" },
          { kind: "subject_organization_manager" },
          { kind: "management_chain" },
        ],
      }),
    )

    expect(result).toEqual({ snapshot: baseProjection().snapshot, candidates: [] })
  })

  test("excludes self, inactive employees, and employees without an Account link", () => {
    const result = resolveOrganizationalAuthority(
      baseProjection({
        criteria: [
          { kind: "employee", employeeId: subjectId },
          { kind: "employee", employeeId: inactiveId },
          { kind: "employee", employeeId: organizationManagerId },
        ],
        accountLinks: [link(subjectId), link(inactiveId)],
      }),
    )

    expect(result).toEqual({ snapshot: baseProjection().snapshot, candidates: [] })
  })

  test("is deterministic when states, links, and concurrent assignments arrive unordered", () => {
    const branchManagerId = employeeId("employee-6")
    const concurrent = assignment({
      employeeId: subjectId,
      managerEmployeeId: branchManagerId,
      organizationUnitId: financeId,
      suffix: "concurrent",
      assignmentType: "CONCURRENT",
    })
    const projection = baseProjection({
      criteria: [{ kind: "management_chain" }],
      states: [
        state({ employeeId: branchManagerId }),
        ...baseProjection().states.map((item) =>
          item.employeeId === subjectId
            ? state({
                employeeId: subjectId,
                managerEmployeeId: managerId,
                organizationUnitId: productId,
                concurrentAssignments: [concurrent],
              })
            : item,
        ),
      ].reverse(),
      accountLinks: [link(branchManagerId), ...baseProjection().accountLinks].reverse(),
    })

    const first = resolveOrganizationalAuthority(projection)
    const second = resolveOrganizationalAuthority({
      ...projection,
      states: [...projection.states].reverse(),
      accountLinks: [...projection.accountLinks].reverse(),
    })

    expect(first).toEqual(second)
    expect(first).toMatchObject({
      candidates: [
        { employeeId: managerId },
        { employeeId: branchManagerId },
        { employeeId: executiveId },
      ],
    })
  })

  test("rejects a cycle anywhere in the loaded management graph", () => {
    expectError(
      baseProjection({
        states: baseProjection().states.map((item) =>
          item.employeeId === executiveId
            ? state({
                employeeId: executiveId,
                managerEmployeeId: subjectId,
                organizationUnitId: financeId,
              })
            : item,
        ),
      }),
      "organizational_authority_manager_cycle",
    )
  })

  test("rejects duplicate Employee states and mismatched business dates", () => {
    expectError(
      baseProjection({ states: [...baseProjection().states, baseProjection().states[0]!] }),
      "organizational_authority_employee_duplicate",
    )
    expectError(
      baseProjection({
        states: baseProjection().states.map((item) =>
          item.employeeId === subjectId
            ? { ...item, asOf: restoreCalendarDate("2026-06-02") }
            : item,
        ),
      }),
      "organizational_authority_state_as_of_mismatch",
    )
  })

  test("rejects period ownership drift, duplicate periods, and dangling managers", () => {
    const subject = baseProjection().states[0]!
    const manager = baseProjection().states[1]!
    expectError(
      baseProjection({
        states: [
          {
            ...subject,
            primaryAssignment: { ...subject.primaryAssignment!, employeeId: managerId },
          },
          ...baseProjection().states.slice(1),
        ],
      }),
      "organizational_authority_period_invalid",
    )
    expectError(
      baseProjection({
        states: [
          subject,
          {
            ...manager,
            primaryAssignment: {
              ...manager.primaryAssignment!,
              periodId: subject.primaryAssignment!.periodId,
            },
          },
          ...baseProjection().states.slice(2),
        ],
      }),
      "organizational_authority_period_duplicate",
    )
    expectError(
      baseProjection({
        states: [
          {
            ...subject,
            primaryAssignment: {
              ...subject.primaryAssignment!,
              managerEmployeeId: employeeId("employee-missing"),
            },
          },
          ...baseProjection().states.slice(1),
        ],
      }),
      "organizational_authority_employee_reference_missing",
    )
  })

  test("rejects an inactive manager and a responsibility without an assignment", () => {
    expectError(
      baseProjection({
        states: baseProjection().states.map((item) =>
          item.employeeId === managerId
            ? state({ employeeId: managerId, status: "TERMINATED" })
            : item,
        ),
      }),
      "organizational_authority_state_invalid",
    )
    expectError(
      baseProjection({
        states: baseProjection().states.map((item) =>
          item.employeeId === organizationManagerId ? { ...item, primaryAssignment: null } : item,
        ),
      }),
      "organizational_authority_period_invalid",
    )
  })

  test("rejects ambiguous or dangling Account links", () => {
    expectError(
      baseProjection({
        accountLinks: [...baseProjection().accountLinks, link(subjectId, "account-another")],
      }),
      "organizational_authority_account_employee_duplicate",
    )
    expectError(
      baseProjection({
        accountLinks: [link(subjectId, "account-shared"), link(managerId, "account-shared")],
      }),
      "organizational_authority_account_duplicate",
    )
    expectError(
      baseProjection({
        accountLinks: [link(employeeId("employee-missing"))],
      }),
      "organizational_authority_account_employee_missing",
    )
  })

  test("rejects missing subject and explicit Employee references", () => {
    expectError(
      baseProjection({ subjectEmployeeId: employeeId("employee-missing") }),
      "organizational_authority_subject_missing",
    )
    expectError(
      baseProjection({
        criteria: [{ kind: "employee", employeeId: employeeId("employee-missing") }],
      }),
      "organizational_authority_employee_reference_missing",
    )
  })

  test("requires lifecycle revision and forbids revision on a legacy snapshot", () => {
    expectError(
      baseProjection({
        snapshot: { ...baseProjection().snapshot, organizationRevision: null },
      }),
      "organizational_authority_snapshot_invalid",
    )
    expectError(
      baseProjection({
        snapshot: {
          ...baseProjection().snapshot,
          source: "legacy",
          organizationRevision: 1,
        },
      }),
      "organizational_authority_snapshot_invalid",
    )
  })
})
