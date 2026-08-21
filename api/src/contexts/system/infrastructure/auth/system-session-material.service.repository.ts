import {
  zSessionFamilyId,
  type SessionFamilyId,
} from "@system/domain/values/session-family-id.schema"
import { zSessionId, type SessionId } from "@system/domain/values/session-id.schema"
import {
  zSessionTokenHash,
  type SessionTokenHash,
} from "@system/domain/values/session-token-hash.schema"
import { generateOpaqueToken } from "@system/infrastructure/auth/generate-opaque-token.repository"

/** Web Cryptoで256-bit token・opaque ID・SHA-256 hashを生成するportable adapter。 */
export class SystemSessionMaterialService {
  generateSessionId(): SessionId | Error {
    const parsed = zSessionId.safeParse(crypto.randomUUID())

    return parsed.success ? parsed.data : new Error("failed to generate System Session ID")
  }

  generateFamilyId(): SessionFamilyId | Error {
    const parsed = zSessionFamilyId.safeParse(crypto.randomUUID())

    return parsed.success ? parsed.data : new Error("failed to generate System Session family ID")
  }

  generateRawToken(): string | Error {
    try {
      return generateOpaqueToken()
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to generate System Session token")
    }
  }

  async hashRawToken(rawToken: string): Promise<SessionTokenHash | Error> {
    try {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken))
      const hex = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("")
      const parsed = zSessionTokenHash.safeParse(hex)

      return parsed.success ? parsed.data : new Error("failed to hash System Session token")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to hash System Session token")
    }
  }
}
