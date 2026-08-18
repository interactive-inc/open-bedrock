import { isCompanyIdentifier } from "@/contexts/company/domain/core/is-company-identifier"
import { z } from "zod"

export const companyIdentifierSchema = z.string().refine(isCompanyIdentifier)
