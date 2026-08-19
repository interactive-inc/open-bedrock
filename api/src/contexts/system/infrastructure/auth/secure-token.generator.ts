import { generateOpaqueToken } from "@system/infrastructure/auth/generate-opaque-token"

export class SecureTokenGenerator {
  static generate(): string {
    return generateOpaqueToken()
  }
}
