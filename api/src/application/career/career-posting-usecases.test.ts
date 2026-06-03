import { describe, expect, test } from "bun:test"
import { CreateCareerPosting } from "@/application/career/create-career-posting"
import { DeleteCareerPosting } from "@/application/career/delete-career-posting"
import { GetCareerPosting } from "@/application/career/get-career-posting"
import { UpdateCareerPosting } from "@/application/career/update-career-posting"
import { CareerPosting } from "@/domain/career/career-posting"
import type { Context } from "@/env"
import { createTestContext } from "@/interface/shared/test/create-test-context"

async function seedPosting(context: Context): Promise<number> {
  const created = await new CreateCareerPosting(context).run({
    viewerRole: "admin",
    title: "Platform Engineer",
    deptId: 3,
    deptName: "Engineering",
    requiredSkills: "typescript",
    status: "open",
  })

  if (created instanceof Error || "reason" in created || created.id === null) {
    throw new Error("seed failed")
  }

  return created.id
}

describe("CreateCareerPosting", () => {
  test("admin creates a posting and the DB assigns an id", async () => {
    const { context } = createTestContext()

    const created = await new CreateCareerPosting(context).run({
      viewerRole: "hr",
      title: "Data Analyst",
      deptId: null,
      deptName: null,
      requiredSkills: null,
      status: "open",
    })

    expect(created).toBeInstanceOf(CareerPosting)

    if (created instanceof Error || "reason" in created) {
      throw new Error("create failed")
    }

    expect(created.id).not.toBe(null)
    expect(created.status).toBe("open")
  })

  test("a non-privileged role is forbidden", async () => {
    const { context } = createTestContext()

    const created = await new CreateCareerPosting(context).run({
      viewerRole: "member",
      title: "X",
      deptId: null,
      deptName: null,
      requiredSkills: null,
      status: "open",
    })

    expect(created instanceof CareerPosting).toBe(false)

    if (created instanceof Error) {
      throw new Error("unexpected error")
    }

    if ("reason" in created) {
      expect(created.reason).toBe("forbidden")
    }
  })
})

describe("GetCareerPosting", () => {
  test("admin reads an existing posting", async () => {
    const { context } = createTestContext()

    const postingId = await seedPosting(context)

    const result = await new GetCareerPosting(context).run({
      viewerRole: "admin",
      postingId: postingId,
    })

    expect(result).toBeInstanceOf(CareerPosting)
  })

  test("returns posting_not_found for a missing id", async () => {
    const { context } = createTestContext()

    const result = await new GetCareerPosting(context).run({
      viewerRole: "admin",
      postingId: 9999,
    })

    if (result instanceof Error || result instanceof CareerPosting) {
      throw new Error("unexpected result")
    }

    expect(result.reason).toBe("posting_not_found")
  })

  test("a non-privileged role is forbidden", async () => {
    const { context } = createTestContext()

    const postingId = await seedPosting(context)

    const result = await new GetCareerPosting(context).run({
      viewerRole: "member",
      postingId: postingId,
    })

    if (result instanceof Error || result instanceof CareerPosting) {
      throw new Error("unexpected result")
    }

    expect(result.reason).toBe("forbidden")
  })
})

describe("UpdateCareerPosting", () => {
  test("admin updates a posting's content and status", async () => {
    const { context } = createTestContext()

    const postingId = await seedPosting(context)

    const updated = await new UpdateCareerPosting(context).run({
      viewerRole: "admin",
      postingId: postingId,
      title: "Senior Platform Engineer",
      deptId: 3,
      deptName: "Engineering",
      requiredSkills: "typescript,go",
      status: "closed",
    })

    expect(updated).toBeInstanceOf(CareerPosting)

    if (updated instanceof Error || "reason" in updated) {
      throw new Error("update failed")
    }

    expect(updated.title).toBe("Senior Platform Engineer")
    expect(updated.status).toBe("closed")
  })

  test("returns posting_not_found for a missing id", async () => {
    const { context } = createTestContext()

    const updated = await new UpdateCareerPosting(context).run({
      viewerRole: "admin",
      postingId: 9999,
      title: "X",
      deptId: null,
      deptName: null,
      requiredSkills: null,
      status: "open",
    })

    if (updated instanceof Error || updated instanceof CareerPosting) {
      throw new Error("unexpected result")
    }

    expect(updated.reason).toBe("posting_not_found")
  })
})

describe("DeleteCareerPosting", () => {
  test("admin deletes a posting", async () => {
    const { context } = createTestContext()

    const postingId = await seedPosting(context)

    const result = await new DeleteCareerPosting(context).run({
      viewerRole: "admin",
      postingId: postingId,
    })

    if (result instanceof Error) {
      throw new Error("delete failed")
    }

    expect(result.reason).toBe("deleted")

    const afterDelete = await new GetCareerPosting(context).run({
      viewerRole: "admin",
      postingId: postingId,
    })

    if (afterDelete instanceof Error || afterDelete instanceof CareerPosting) {
      throw new Error("unexpected result")
    }

    expect(afterDelete.reason).toBe("posting_not_found")
  })

  test("a non-privileged role is forbidden", async () => {
    const { context } = createTestContext()

    const postingId = await seedPosting(context)

    const result = await new DeleteCareerPosting(context).run({
      viewerRole: "member",
      postingId: postingId,
    })

    if (result instanceof Error) {
      throw new Error("unexpected error")
    }

    expect(result.reason).toBe("forbidden")
  })
})
