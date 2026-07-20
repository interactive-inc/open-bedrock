import type { ReviewCyclePolicy } from "@/domain/review/review-cycle-policy"
import type { Context } from "@/env"
import { EmployeeLifecycleReadRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-read-repository"
import { EmployeeLifecycleRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { ApplicationError } from "@/lib/errors"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"
import { employees, orgMemberships } from "@/schema"
import { asc, eq } from "drizzle-orm"

type Assignment = {
  subjectEmployeeId: number
  reviewerEmployeeId: number
  reviewerType: "self" | "manager" | "peer" | "subordinate"
}

type ReviewEmployee = { id: number; code: string }

type ReviewMembership = {
  employeeCode: string
  departmentCode: string
  managerEmployeeCode: string | null
}

async function loadReviewPopulation(c: Context): Promise<{
  employeeRows: ReadonlyArray<ReviewEmployee>
  membershipRows: ReadonlyArray<ReviewMembership>
}> {
  const migrationStatus = await new EmployeeLifecycleRepository(c).migrationStatus()
  if (migrationStatus instanceof ApplicationError) throw migrationStatus

  if (migrationStatus !== "verified") {
    const [employeeRows, membershipRows] = await Promise.all([
      c.var.database
        .select({ id: employees.id, code: employees.code })
        .from(employees)
        .where(eq(employees.status, "active"))
        .orderBy(asc(employees.id)),
      c.var.database.select().from(orgMemberships),
    ])
    return { employeeRows, membershipRows }
  }

  const businessDate = resolveCompanyBusinessDate({
    now: c.env.NOW ?? new Date().toISOString(),
    timeZone: c.env.COMPANY_TIME_ZONE,
  })
  if (typeof businessDate !== "string") throw businessDate

  const allEmployees = await c.var.database
    .select({ id: employees.id, code: employees.code })
    .from(employees)
    .orderBy(asc(employees.id))
  const states = await new EmployeeLifecycleReadRepository(c).findStatesAt(
    allEmployees.map((employee) => employee.id),
    businessDate,
  )
  if (states instanceof ApplicationError) throw states

  const employeeRows = allEmployees.filter((employee) => {
    const state = states.get(employee.id)
    return state?.status === "active" && state.archived === false
  })
  const activeCodes = new Set(employeeRows.map((employee) => employee.code))
  const membershipRows = employeeRows.flatMap((employee) => {
    const state = states.get(employee.id)
    if (state === undefined) return []
    return [
      ...(state.primaryAssignment === null ? [] : [state.primaryAssignment]),
      ...state.concurrentAssignments,
    ].map((assignment) => ({
      employeeCode: employee.code,
      departmentCode: assignment.departmentCode,
      managerEmployeeCode:
        assignment.managerEmployeeCode !== null && activeCodes.has(assignment.managerEmployeeCode)
          ? assignment.managerEmployeeCode
          : null,
    }))
  })

  return { employeeRows, membershipRows }
}

export async function generateReviewForms(props: {
  c: Context
  cycleId: number
  policy: ReviewCyclePolicy
}): Promise<number | Error> {
  try {
    const { employeeRows, membershipRows } = await loadReviewPopulation(props.c)

    const idByCode = new Map(employeeRows.map((employee) => [employee.code, employee.id] as const))
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
        add({ subjectEmployeeId: subject.id, reviewerEmployeeId: subject.id, reviewerType: "self" })
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
        const departmentCodes = new Set(memberships.map((membership) => membership.departmentCode))
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
          add({ subjectEmployeeId: subject.id, reviewerEmployeeId: peer.id, reviewerType: "peer" })
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
      props.c.env.DB.prepare(
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
      await props.c.env.DB.batch(statements.slice(index, index + 50))
    }

    return statements.length
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to generate review forms")
  }
}
