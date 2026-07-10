import { AntisocialCheck } from "@/domain/antisocial-check/antisocial-check.entity"
import { describe, expect, test } from "bun:test"

describe("AntisocialCheck.create", () => {
  test("builds with UUID id, requested status, and null result", () => {
    const check = AntisocialCheck.create({
      requesterId: 1,
      partnerName: "Sample Corp",
      partnerAddress: "1-2-3 Example, Tokyo",
      representativeName: "Taro Yamada",
      createdAt: "2026-06-01T09:00:00.000Z",
    })

    expect(check).toBeInstanceOf(AntisocialCheck)
    expect(check.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(check.status).toBe("requested")
    expect(check.result).toBeNull()
    expect(check.requesterId).toBe(1)
    expect(check.partnerName).toBe("Sample Corp")
    expect(check.partnerAddress).toBe("1-2-3 Example, Tokyo")
    expect(check.representativeName).toBe("Taro Yamada")
  })
})

describe("AntisocialCheck.withDetails", () => {
  test("returns new instance with changed fields", () => {
    const check = AntisocialCheck.create({
      requesterId: 1,
      partnerName: "Sample Corp",
      partnerAddress: null,
      representativeName: null,
      createdAt: "2026-06-01T09:00:00.000Z",
    })

    const updated = check.withDetails({
      partnerName: "Updated Corp",
      partnerAddress: "4-5-6 Example, Osaka",
      representativeName: "Hanako Suzuki",
      result: "clear",
    })

    expect(updated).toBeInstanceOf(AntisocialCheck)
    expect(updated.partnerName).toBe("Updated Corp")
    expect(updated.partnerAddress).toBe("4-5-6 Example, Osaka")
    expect(updated.representativeName).toBe("Hanako Suzuki")
    expect(updated.result).toBe("clear")
    expect(updated.requesterId).toBe(1)
    expect(updated.status).toBe("completed")
  })
})
