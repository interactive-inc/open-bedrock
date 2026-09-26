import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type { OrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id.definition"

/**
 * seed とテストの組織単位の ID。組織単位の ID は UUID なので、組織コードから決まる UUID を使う。
 * seeds/org.sql と同じ形（`0190005e-0000-7000-8000-<コードの16進>`）にし、seed の組織単位を指せるようにする。
 */
export function seedOrganizationUnitId(code: string): string {
  const hex = Buffer.from(code, "utf8").toString("hex")
  if (hex.length > 12) throw new Error(`organization unit code is too long for a seed id: ${code}`)
  return `0190005e-0000-7000-8000-${hex.padStart(12, "0")}`
}

export function testOrganizationUnitId(code: string): OrganizationUnitId {
  return restoreWorkforceId("organization_unit", seedOrganizationUnitId(code))
}
