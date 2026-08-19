import { describe, expect, test } from "bun:test"
import { IamIdentityEntity } from "@/contexts/system/domain/identity/iam-identity.entity"
import { InvalidIamIdentityError } from "@/contexts/system/domain/identity/invalid-iam-identity.error"

const NOW = new Date("2026-08-11T00:00:00.000Z")

function identityProps(providerSubject: string) {
  return {
    id: "identity-1",
    userId: "account-1",
    provider: "oidc" as const,
    providerSubject,
    email: null,
    passwordHash: null,
    canReceiveEmail: false,
    emailVerifiedAt: null,
    passwordChangedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

describe("IamIdentityEntity", () => {
  test("provider subjectを正規化せずcase-sensitiveに保持する", () => {
    const identity = IamIdentityEntity.create(identityProps("Subject-A"))

    expect(identity).toBeInstanceOf(IamIdentityEntity)
    expect(identity instanceof Error ? null : String(identity.providerSubject)).toBe("Subject-A")
  })

  test.each(["", "a".repeat(256), "line\nbreak", "ユーザー"])(
    "永続化へ渡す前に無効なprovider subjectを拒否する",
    (providerSubject) => {
      expect(IamIdentityEntity.create(identityProps(providerSubject))).toBeInstanceOf(
        InvalidIamIdentityError,
      )
    },
  )
})
