import { zAccountId, type AccountId } from "@system/domain/values/account-id.schema"

export function testAccountId(value: string | number): AccountId {
  return zAccountId.parse(String(value))
}
