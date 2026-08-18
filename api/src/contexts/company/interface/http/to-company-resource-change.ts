import type {
  CompanyJsonObject,
  CompanyResourceChange,
} from "@/contexts/company/domain/core/company-resource"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/restore-calendar-date"
import { companyResourceSchema } from "@/contexts/company/interface/http/company-resource-schema"
import { companyWriteHeaderSchema } from "@/contexts/company/interface/http/company-write-header-schema"
import type { z } from "zod"

type CompanyWriteRequest = Readonly<{
  reason: string
  resources: ReadonlyArray<z.infer<typeof companyResourceSchema>>
}>

export function toCompanyResourceChange(
  headers: z.infer<typeof companyWriteHeaderSchema>,
  body: CompanyWriteRequest,
  recordedAt: number,
): Omit<CompanyResourceChange, "actorAccountId"> | null {
  const normalizedRevision = headers["if-match"].replace(/^W\//, "").replace(/^"|"$/g, "")
  const organizationId = headers["x-company-organization-id"]
  if (body.resources.some((resource) => resource.organizationId !== organizationId)) return null
  return {
    commandId: headers["idempotency-key"],
    expectedRevision: Number(normalizedRevision),
    reason: body.reason,
    recordedAt,
    resources: body.resources.map((resource) => ({
      ...resource,
      effectiveFrom: restoreCalendarDate(resource.effectiveFrom),
      effectiveTo: resource.effectiveTo === null ? null : restoreCalendarDate(resource.effectiveTo),
      attributes: resource.attributes as CompanyJsonObject,
    })),
  }
}
