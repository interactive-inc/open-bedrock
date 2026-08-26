import type * as systemSchema from "@system/infrastructure/schema/system"
import type * as companyCoreSchema from "@/contexts/company/infrastructure/schema/company"
import type * as employeeSchema from "@/contexts/company/infrastructure/schema/employee"
import type * as employmentSchema from "@/contexts/company/infrastructure/schema/employment"
import type * as organizationSchema from "@/contexts/company/infrastructure/schema/organization"
import type * as companyRelationsSchema from "@/contexts/company/infrastructure/schema/company-relations"
import type { DrizzleD1Database } from "drizzle-orm/d1"

/** Companyが所有する正本と、直接依存するportableなSystem schemaの完全な合成型。 */
export type CompanyDatabaseSchema = typeof systemSchema &
  typeof companyCoreSchema &
  typeof employeeSchema &
  typeof employmentSchema &
  typeof organizationSchema &
  typeof companyRelationsSchema

export type CompanyDatabase = DrizzleD1Database<CompanyDatabaseSchema>
