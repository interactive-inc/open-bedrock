import { z } from "zod"
import { companyResourceTypes } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"

const schema = z.object({
  organization_revision: z.number().int().positive(),
  resource_type: z.enum(companyResourceTypes),
  resource_id: z.string().min(1),
  revision: z.number().int().positive(),
  command_id: z.string().min(1),
  state: z.enum(["active", "void"]),
  effective_from: z.string().date(),
  effective_to: z.string().date().nullable(),
  recorded_at: z.number().int().nonnegative(),
})

/** 公開資源の確定した変更位置と有効期間。資源の属性や実行許可は含めない。 */
export class CompanyChangeRecordEntity {
  private constructor(readonly props: Readonly<z.infer<typeof schema>>) {
    Object.freeze(this)
  }

  static restore(value: unknown): CompanyChangeRecordEntity | Error {
    const parsed = schema.safeParse(value)
    if (!parsed.success) return parsed.error
    return new CompanyChangeRecordEntity(Object.freeze(parsed.data))
  }
}
