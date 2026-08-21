import type { CompanyResourceChange } from "@/contexts/company/domain/core/company-resource"
import { companyBytesToHex } from "@/contexts/company/infrastructure/core/company-bytes-to-hex.repository"
import { toCanonicalSystemJson } from "@system/domain/workflow/to-canonical-system-json"

const textEncoder = new TextEncoder()

export async function fingerprintCompanyResourceChange(
  change: CompanyResourceChange,
): Promise<string | Error> {
  const canonical = toCanonicalSystemJson({
    expectedRevision: change.expectedRevision,
    actorAccountId: change.actorAccountId,
    reason: change.reason,
    resources: change.resources,
  })
  if (canonical instanceof Error) return canonical
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(canonical))
  return companyBytesToHex(new Uint8Array(digest))
}
