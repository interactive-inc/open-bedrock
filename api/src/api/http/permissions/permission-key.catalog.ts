import { COMPANY_PERMISSION_KEYS } from "@/api/http/permissions/company-permission-key.catalog"
import { SYSTEM_PERMISSION_KEYS } from "@system/domain/values/system-permission-key.catalog"
import { BUSINESS_PERMISSION_KEYS } from "@/api/http/permissions/business-permission-key.catalog"
import { SYSTEM_CAPABILITY_PERMISSION_KEYS } from "@/api/http/permissions/system-capability-permission-key.catalog"
import { z } from "zod"

/** 各bounded contextが所有する権限語彙を、APIとDB投影のために合成する。 */
export const PERMISSION_KEYS = [
  ...SYSTEM_PERMISSION_KEYS,
  ...SYSTEM_CAPABILITY_PERMISSION_KEYS,
  ...COMPANY_PERMISSION_KEYS,
  ...BUSINESS_PERMISSION_KEYS,
] as const

export const PERMISSION_KEYS_BY_CONTEXT = {
  system: [...SYSTEM_PERMISSION_KEYS, ...SYSTEM_CAPABILITY_PERMISSION_KEYS],
  company: COMPANY_PERMISSION_KEYS,
  business: BUSINESS_PERMISSION_KEYS,
} as const

export type PermissionContext = keyof typeof PERMISSION_KEYS_BY_CONTEXT

export const permissionKeySchema = z.enum(PERMISSION_KEYS)
export type PermissionKey = z.infer<typeof permissionKeySchema>
