import { Partner } from "@/contexts/partner/domain/entities/partner.entity"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/lib/d1/is-unique-constraint-error"
import { UniqueConstraintError } from "@/lib/d1/errors"
import { partners } from "@/contexts/partner/infrastructure/schema/partner"
import { eq } from "drizzle-orm"

export class PartnerRepository {
  constructor(private readonly c: Context) {}

  async findByCode(code: string): Promise<Partner | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(partners)
        .where(eq(partners.code, code))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Partner.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load partner")
    }
  }

  async findById(id: number): Promise<Partner | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(partners)
        .where(eq(partners.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Partner.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load partner")
    }
  }

  async create(partner: Partner): Promise<Partner | Error> {
    try {
      const rows = await this.c.var.database
        .insert(partners)
        .values({
          code: partner.code,
          name: partner.name,
          category: partner.category,
          corporateNumber: partner.corporateNumber,
          note: partner.note,
          status: partner.status,
          createdAt: partner.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to insert partner") : Partner.fromRow(row)
    } catch (error) {
      // (code) の UNIQUE 制約違反 = 並行リクエストによる二重登録。
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("partner code already exists", { cause: error })
      }

      return error instanceof Error ? error : new Error("failed to insert partner")
    }
  }

  async update(partner: Partner): Promise<Partner | null | Error> {
    try {
      if (partner.id === null) {
        return new Error("cannot update unsaved partner")
      }

      const rows = await this.c.var.database
        .update(partners)
        .set({
          name: partner.name,
          category: partner.category,
          corporateNumber: partner.corporateNumber,
          note: partner.note,
          status: partner.status,
        })
        .where(eq(partners.id, partner.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Partner.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update partner")
    }
  }
}
