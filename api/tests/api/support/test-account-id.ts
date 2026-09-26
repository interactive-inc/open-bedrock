import { testAccountId as identityAccountId } from "@system/test/system-test-id.test-support"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"

export function testAccountId(value: string | number): AccountId {
  return zAccountId.parse(identityAccountId(value))
}
