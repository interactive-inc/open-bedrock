import { describe, expect, test } from "bun:test"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { ResolveCompanyGovernanceTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-governance-task.adapter"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { zApplicationWorkflowStep } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"

describe("公開Companyから業務Taskへの接続", () => {
  test.each(["employee", "organizational-office"])(
    "個人・役職への責務割当を候補と委任規則へ接続する: %s",
    async (holderType) => {
      const c = await createGovernanceTaskTestContext()
      const person = c.people[1]
      const assignment = c.resources.find(
        (resource) => resource.type === "responsibility-assignment",
      )
      if (person === undefined || assignment === undefined)
        throw new Error("holder fixture is missing")
      const changes: CompanyResourceProps[] = []
      if (holderType === "organizational-office") {
        const employmentId = await c.database
          .prepare(
            "SELECT resource_id FROM company_workforce_resource_bindings WHERE employee_id = ?1 AND resource_type = 'employment'",
          )
          .bind(person.employeeId)
          .first<string>("resource_id")
        if (employmentId === null) throw new Error("employment fixture is missing")
        changes.push(
          {
            ...assignment,
            revision: 1,
            type: "organization-unit",
            id: "unit:review",
            attributes: {
              organizationUnitId: "unit:review",
              code: "REVIEW",
              officialName: "Review",
              kind: "DEPARTMENT",
              parentOrganizationUnitId: null,
            },
          },
          {
            ...assignment,
            revision: 1,
            type: "position",
            id: "position:review",
            attributes: { code: "REVIEWER", officialName: "Reviewer" },
          },
          {
            ...assignment,
            revision: 1,
            type: "organizational-office",
            id: "office:review",
            attributes: {
              code: "REVIEWER",
              officialName: "Reviewer",
              organizationUnitId: "unit:review",
              positionId: "position:review",
            },
          },
          {
            ...assignment,
            revision: 1,
            type: "office-assignment",
            id: "office-assignment:review",
            attributes: {
              employeeId: person.employeeId,
              employmentId,
              organizationalOfficeId: "office:review",
            },
          },
        )
      }
      changes.push({
        ...assignment,
        revision: 2,
        attributes: {
          ...assignment.attributes,
          holderType,
          holderId: holderType === "employee" ? person.employeeId : "office:review",
          delegationAllowed: true,
        },
      })
      await c.write(changes)
      const resolved = await new ResolveCompanyGovernanceTaskAdapter(c.context).resolve({
        step: c.step,
        payload: { amount: 500 },
        subjectEmployeeId: c.creator.employeeId,
        excludedEmployeeIds: new Set([c.creator.employeeId]),
        openedAt: c.at,
        dueAt: null,
        resolvedAt: c.at,
      })
      if (resolved instanceof Error) throw resolved
      expect(resolved.task).toMatchObject({
        requiredApprovals: 1,
        requiredParticipants: 1,
        delegationPolicy: "allowed",
        returnPolicy: "allowed",
      })
      expect(resolved.task.candidates.map((candidate) => candidate.accountId)).toEqual([
        person.accountId,
      ])
    },
  )

  test("公開Account対応が業務台帳と違う場合はTaskを作らない", async () => {
    const c = await createGovernanceTaskTestContext()
    const first = c.resources.find((resource) => resource.id === "link:1")
    const second = c.resources.find((resource) => resource.id === "link:2")
    if (first === undefined || second === undefined) throw new Error("link fixtures are missing")
    await c.write([
      {
        ...first,
        revision: 2,
        attributes: { ...first.attributes, accountId: second.attributes.accountId },
      },
      {
        ...second,
        revision: 2,
        attributes: { ...second.attributes, accountId: first.attributes.accountId },
      },
    ])
    expect(
      await new ResolveCompanyGovernanceTaskAdapter(c.context).resolve({
        step: c.step,
        payload: { amount: 500 },
        subjectEmployeeId: c.creator.employeeId,
        excludedEmployeeIds: new Set([c.creator.employeeId]),
        openedAt: c.at,
        dueAt: null,
        resolvedAt: c.at,
      }),
    ).toBeInstanceOf(Error)
  })

  test("金額と合議の規程を評価し、Systemへ候補と変更検知を渡す", async () => {
    const c = await createGovernanceTaskTestContext()
    const resolver = new ResolveCompanyGovernanceTaskAdapter(c.context)
    const input = {
      step: c.step,
      payload: { amount: 500 },
      subjectEmployeeId: c.creator.employeeId,
      excludedEmployeeIds: new Set([c.creator.employeeId]),
      openedAt: c.at,
      dueAt: null,
      resolvedAt: c.at,
    }
    const resolved = await resolver.resolve(input)
    if (resolved instanceof Error) throw resolved
    expect(resolved.task).toMatchObject({
      requiredApprovals: 2,
      requiredParticipants: 2,
      delegationPolicy: "forbidden",
      returnPolicy: "forbidden",
    })
    expect(resolved.task.candidates.map((candidate) => candidate.accountId).sort()).toEqual(
      c.people
        .slice(1)
        .map((person) => person.accountId)
        .sort(),
    )
    expect(await resolver.resolve({ ...input, payload: { amount: 1001 } })).toBeInstanceOf(Error)
    expect(await resolver.resolve({ ...input, payload: { amount: "500" } })).toBeInstanceOf(Error)
    const assignment = c.resources.find((resource) => resource.type === "responsibility-assignment")
    if (assignment === undefined) throw new Error("assignment is missing")
    await c.write([{ ...assignment, revision: 2, state: "void" }])
    const failure = await c.database.batch([...resolved.guards]).then(
      () => null,
      (cause: unknown) => cause,
    )
    expect(failure).toBeInstanceOf(Error)
    expect(await resolver.resolve(input)).toBeInstanceOf(Error)
  })

  test("個別候補と人数の上書きを混在させず、定義を保存する", async () => {
    const c = await createGovernanceTaskTestContext()
    expect(zApplicationWorkflowStep.parse(c.step).governance_authority).toEqual(
      c.step.governance_authority,
    )
    expect(
      zApplicationWorkflowStep.safeParse({
        ...c.step,
        approval_mode: "minimum",
        minimum_approvals: 1,
      }).success,
    ).toBe(false)
    expect(
      zApplicationWorkflowStep.safeParse({ ...c.step, approvers: [{ type: "management_chain" }] })
        .success,
    ).toBe(false)
  })
})
