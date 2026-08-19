import { zAccountId, type AccountId } from "@/contexts/system/domain/auth/account-id"

export function testAccountId(value: string | number): AccountId {
  return zAccountId.parse(String(value))
}
