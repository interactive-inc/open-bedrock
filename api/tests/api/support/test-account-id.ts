import { testAccountId as identityAccountId } from "@tests/api/support/test-identity-id"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"

export function testAccountId(value: string | number): AccountId {
  return zAccountId.parse(identityAccountId(value))
}
