import { ReadCanonicalOrganizationStateAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-canonical-organization-state.adapter"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import type { ReviewCyclePolicy } from "@/contexts/performance-review/domain/definitions/review-cycle-policy.definition"
import type { Context } from "@/env"
import { asc } from "drizzle-orm"

type Assignment = {
  subjectEmployeeId: EmployeeId
  reviewerEmployeeId: EmployeeId
  reviewerType: "self" | "manager" | "peer" | "subordinate"
}

type ReviewEmployee = { id: EmployeeId; code: string }

type ReviewMembership = {
  employeeCode: string
  departmentCode: string
  managerEmployeeCode: string | null
}

async function loadReviewPopulation(c: Context): Promise<{
  employeeRows: ReadonlyArray<ReviewEmployee>
  membershipRows: ReadonlyArray<ReviewMembership>
}> {
  const snapshot = await new ReadCanonicalOrganizationStateAdapter(
    c,
  ).readCanonicalOrganizationState()
  if (snapshot instanceof Error) throw snapshot

  const employeeProfiles = await c.var.database
    .select({ id: employees.id, code: employees.employeeCode })
    .from(employees)
    .orderBy(asc(employees.id))

  const profileByEmployeeId = new Map<EmployeeId, ReviewEmployee>(
    employeeProfiles.flatMap((employee) =>
      employee.code === null ? [] : [[employee.id, { id: employee.id, code: employee.code }]],
    ),
  )
  const activeStates = snapshot.employees.filter((state) => state.status === "ACTIVE")
  const activeProfileByEmployeeId = new Map<EmployeeId, ReviewEmployee>(
    activeStates.flatMap((state) => {
      const profile = profileByEmployeeId.get(state.employeeId)
      return profile === undefined ? [] : [[state.employeeId, profile]]
    }),
  )
  const employeeRows = [...activeProfileByEmployeeId.values()].toSorted((left, right) =>
    left.id.localeCompare(right.id),
  )
  const organizationCodeById = new Map(
    snapshot.organization.units.map((unit) => [unit.organizationUnitId, unit.code]),
  )
  const membershipRows = activeStates.flatMap((state) => {
    const employee = activeProfileByEmployeeId.get(state.employeeId)
    if (employee === undefined) return []

    return [
      ...(state.primaryAssignment === null ? [] : [state.primaryAssignment]),
      ...state.concurrentAssignments,
    ].flatMap((assignment) => {
      const departmentCode = organizationCodeById.get(assignment.organizationUnitId)
      if (departmentCode === undefined) return []

      return [
        {
          employeeCode: employee.code,
          departmentCode,
          managerEmployeeCode:
            assignment.managerEmployeeId === null
              ? null
              : (activeProfileByEmployeeId.get(assignment.managerEmployeeId)?.code ?? null),
        },
      ]
    })
  })

  return { employeeRows, membershipRows }
}

export class ReviewFormGenerationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async generate(props: { cycleId: number; policy: ReviewCyclePolicy }): Promise<number | Error> {
    try {
      const { employeeRows, membershipRows } = await loadReviewPopulation(this.c)

      const idByCode = new Map(
        employeeRows.map((employee) => [employee.code, employee.id] as const),
      )
      const membershipsByEmployee = new Map<string, Array<(typeof membershipRows)[number]>>()

      for (const membership of membershipRows) {
        const list = membershipsByEmployee.get(membership.employeeCode) ?? []
        list.push(membership)
        membershipsByEmployee.set(membership.employeeCode, list)
      }

      const assignments = new Map<string, Assignment>()
      const add = (assignment: Assignment) => {
        if (
          assignment.subjectEmployeeId === assignment.reviewerEmployeeId &&
          assignment.reviewerType !== "self"
        )
          return
        assignments.set(
          `${assignment.subjectEmployeeId}:${assignment.reviewerEmployeeId}:${assignment.reviewerType}`,
          assignment,
        )
      }

      for (const subject of employeeRows) {
        const memberships = membershipsByEmployee.get(subject.code) ?? []

        if (props.policy.include_self) {
          add({
            subjectEmployeeId: subject.id,
            reviewerEmployeeId: subject.id,
            reviewerType: "self",
          })
        }

        if (props.policy.include_manager) {
          for (const membership of memberships) {
            const managerId =
              membership.managerEmployeeCode === null
                ? undefined
                : idByCode.get(membership.managerEmployeeCode)
            if (managerId !== undefined) {
              add({
                subjectEmployeeId: subject.id,
                reviewerEmployeeId: managerId,
                reviewerType: "manager",
              })
            }
          }
        }

        if (props.policy.include_peers) {
          const departmentCodes = new Set(
            memberships.map((membership) => membership.departmentCode),
          )
          const peers = employeeRows.filter(
            (candidate) =>
              candidate.id !== subject.id &&
              (membershipsByEmployee.get(candidate.code) ?? []).some((membership) =>
                departmentCodes.has(membership.departmentCode),
              ),
          )
          const selected =
            props.policy.peer_count === 0 ? peers : peers.slice(0, props.policy.peer_count)
          for (const peer of selected) {
            add({
              subjectEmployeeId: subject.id,
              reviewerEmployeeId: peer.id,
              reviewerType: "peer",
            })
          }
        }

        if (props.policy.include_subordinates) {
          for (const membership of membershipRows) {
            if (membership.managerEmployeeCode !== subject.code) continue
            const subordinateId = idByCode.get(membership.employeeCode)
            if (subordinateId !== undefined) {
              add({
                subjectEmployeeId: subject.id,
                reviewerEmployeeId: subordinateId,
                reviewerType: "subordinate",
              })
            }
          }
        }
      }

      const statements = [...assignments.values()].map((assignment) =>
        this.c.env.DB.prepare(
          `INSERT OR IGNORE INTO review_forms
           (cycle_id, subject_employee_id, reviewer_employee_id, reviewer_type, answers, score, comment, status, submitted_at)
           VALUES (?1, ?2, ?3, ?4, '[]', NULL, NULL, 'pending', NULL)`,
        ).bind(
          props.cycleId,
          assignment.subjectEmployeeId,
          assignment.reviewerEmployeeId,
          assignment.reviewerType,
        ),
      )

      for (let index = 0; index < statements.length; index += 50) {
        await this.c.env.DB.batch(statements.slice(index, index + 50))
      }

      return statements.length
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to generate review forms")
    }
  }
}
