import type { CompanyResourceChange } from "@/contexts/company/domain/core/company-resource"
import { companyBytesToHex } from "@/contexts/company/infrastructure/core/company-bytes-to-hex.repository"
import { CanonicalSystemJsonValue } from "@system/domain/values/canonical-system-json.value"

const textEncoder = new TextEncoder()

export async function fingerprintCompanyResourceChange(
  change: CompanyResourceChange,
): Promise<string | Error> {
  const canonical = CanonicalSystemJsonValue.create({
    expectedRevision: change.expectedRevision,
    actorAccountId: change.actorAccountId,
    reason: change.reason,
    resources: change.resources,
  })
  if (canonical instanceof Error) return canonical
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(canonical.toString()))
  return companyBytesToHex(new Uint8Array(digest))
}
