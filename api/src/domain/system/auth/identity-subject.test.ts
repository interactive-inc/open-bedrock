import { identitySubjectSchema } from "@/domain/system/auth/identity-subject"
import { describe, expect, test } from "bun:test"

describe("identitySubjectSchema", () => {
  test("preserves an opaque case-sensitive subject", () => {
    expect(String(identitySubjectSchema.parse("Subject-A"))).toBe("Subject-A")
  })

  test("accepts the 255-character boundary", () => {
    const subject = "a".repeat(255)
    expect(String(identitySubjectSchema.parse(subject))).toBe(subject)
  })

  test.each(["", "a".repeat(256), "line\nbreak", "ユーザー"])(
    "rejects an invalid subject",
    (subject) => {
      expect(identitySubjectSchema.safeParse(subject).success).toBe(false)
    },
  )
})
