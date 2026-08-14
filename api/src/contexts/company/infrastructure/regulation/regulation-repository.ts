import { Regulation } from "@/contexts/company/domain/regulation/regulation.entity"
import { RegulationVersion } from "@/contexts/company/domain/regulation/regulation-version.entity"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/contexts/company/infrastructure/shared/is-unique-constraint-error"
import { UniqueConstraintError } from "@/contexts/company/infrastructure/shared/unique-constraint-error"
import { regulations, regulationVersions } from "@/schema"
import { desc, eq } from "drizzle-orm"

export class RegulationRepository {
  constructor(private readonly c: Context) {}

  async findByCode(code: string): Promise<Regulation | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(regulations)
        .where(eq(regulations.code, code))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Regulation.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load regulation")
    }
  }

  async create(regulation: Regulation): Promise<Regulation | UniqueConstraintError | Error> {
    try {
      const rows = await this.c.var.database
        .insert(regulations)
        .values({
          code: regulation.code,
          title: regulation.title,
          category: regulation.category,
          status: regulation.status,
          createdAt: regulation.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to insert regulation") : Regulation.fromRow(row)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("regulation code already exists", { cause: error })
      }

      return error instanceof Error ? error : new Error("failed to insert regulation")
    }
  }

  async updateStatus(regulation: Regulation): Promise<Regulation | null | Error> {
    try {
      if (regulation.id === null) {
        return new Error("cannot update unsaved regulation")
      }

      const rows = await this.c.var.database
        .update(regulations)
        .set({ status: regulation.status })
        .where(eq(regulations.id, regulation.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Regulation.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update regulation")
    }
  }

  /** 規程の改定版一覧を version 降順（新しい版が先）で返す。 */
  async listVersions(regulationId: number): Promise<ReadonlyArray<RegulationVersion> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(regulationVersions)
        .where(eq(regulationVersions.regulationId, regulationId))
        .orderBy(desc(regulationVersions.version))

      return rows.map((row) => RegulationVersion.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load regulation versions")
    }
  }

  async createVersion(
    version: RegulationVersion,
  ): Promise<RegulationVersion | UniqueConstraintError | Error> {
    try {
      const rows = await this.c.var.database
        .insert(regulationVersions)
        .values({
          regulationId: version.regulationId,
          version: version.version,
          bodyMd: version.bodyMd,
          effectiveOn: version.effectiveOn,
          note: version.note,
          createdAt: version.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert regulation version")
        : RegulationVersion.fromRow(row)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("regulation version already exists", { cause: error })
      }

      return error instanceof Error ? error : new Error("failed to insert regulation version")
    }
  }
}
