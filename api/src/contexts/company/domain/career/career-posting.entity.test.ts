import { CareerPosting } from "@/contexts/company/domain/career/career-posting.entity"
import { describe, expect, test } from "bun:test"

describe("CareerPosting.create", () => {
  test("builds with null id", () => {
    const posting = CareerPosting.create({
      title: "Backend Engineer",
      deptId: 10,
      deptName: "Engineering",
      requiredSkills: "TypeScript, SQL",
      status: "open",
    })

    expect(posting).toBeInstanceOf(CareerPosting)
    expect(posting.id).toBeNull()
    expect(posting.title).toBe("Backend Engineer")
    expect(posting.deptId).toBe(10)
    expect(posting.deptName).toBe("Engineering")
    expect(posting.requiredSkills).toBe("TypeScript, SQL")
    expect(posting.status).toBe("open")
  })
})

describe("CareerPosting.withDetails", () => {
  test("returns new with changed title, dept, skills, and status", () => {
    const posting = CareerPosting.create({
      title: "Backend Engineer",
      deptId: 10,
      deptName: "Engineering",
      requiredSkills: "TypeScript",
      status: "open",
    })

    const updated = posting.withDetails({
      title: "Frontend Engineer",
      deptId: 20,
      deptName: "Design",
      requiredSkills: "React, CSS",
      status: "closed",
    })

    expect(updated).toBeInstanceOf(CareerPosting)
    expect(updated.title).toBe("Frontend Engineer")
    expect(updated.deptId).toBe(20)
    expect(updated.deptName).toBe("Design")
    expect(updated.requiredSkills).toBe("React, CSS")
    expect(updated.status).toBe("closed")
    expect(updated.id).toBeNull()
  })
})
