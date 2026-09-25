import { toWorkforceOrganizationUnitId } from "@/contexts/company/domain/definitions/to-workforce-organization-unit-id.definition"
import { CareerPosting } from "@/contexts/career/domain/entities/career-posting.entity"
import { describe, expect, test } from "bun:test"

describe("CareerPosting.create", () => {
  test("builds with null id and no legacy department name", () => {
    const posting = CareerPosting.create({
      title: "Backend Engineer",
      organizationUnitId: toWorkforceOrganizationUnitId("D003"),
      requiredSkills: "TypeScript, SQL",
      status: "open",
    })

    expect(posting).toBeInstanceOf(CareerPosting)
    expect(posting.id).toBeNull()
    expect(posting.title).toBe("Backend Engineer")
    expect(posting.organizationUnitId).toBe(toWorkforceOrganizationUnitId("D003"))
    expect(posting.legacyDeptName).toBeNull()
    expect(posting.requiredSkills).toBe("TypeScript, SQL")
    expect(posting.status).toBe("open")
  })
})

describe("CareerPosting.fromRow", () => {
  test("keeps the legacy department name without exposing the legacy numeric id", () => {
    const posting = CareerPosting.fromRow({
      id: "01900017-0000-7000-8000-000000000001",
      legacyId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      title: "Backend Engineer",
      deptId: 3,
      deptName: "Engineering",
      organizationUnitId: null,
      requiredSkills: null,
      status: "open",
    })

    expect(posting.organizationUnitId).toBeNull()
    expect(posting.legacyDeptName).toBe("Engineering")
    expect("deptId" in posting).toBe(false)
  })
})

describe("CareerPosting.withDetails", () => {
  test("returns new with changed title, organization unit, skills, and status", () => {
    const posting = CareerPosting.fromRow({
      id: "01900017-0000-7000-8000-000000000007",
      legacyId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      title: "Backend Engineer",
      deptId: 10,
      deptName: "Engineering",
      organizationUnitId: null,
      requiredSkills: "TypeScript",
      status: "open",
    })

    const updated = posting.withDetails({
      title: "Frontend Engineer",
      organizationUnitId: toWorkforceOrganizationUnitId("D004"),
      requiredSkills: "React, CSS",
      status: "closed",
    })

    expect(updated).toBeInstanceOf(CareerPosting)
    expect(updated.title).toBe("Frontend Engineer")
    expect(updated.organizationUnitId).toBe(toWorkforceOrganizationUnitId("D004"))
    expect(updated.legacyDeptName).toBe("Engineering")
    expect(updated.requiredSkills).toBe("React, CSS")
    expect(updated.status).toBe("closed")
    expect(updated.id).toBe("01900017-0000-7000-8000-000000000007")
  })
})
