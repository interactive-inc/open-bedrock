import { AntisocialCheck } from "@/domain/antisocial-check/antisocial-check.entity"
import type { Context } from "@/env"
import { antisocialChecks } from "@/schema"
import { and, desc, eq } from "drizzle-orm"

export class AntisocialCheckRepository {
  constructor(private readonly c: Context) {}

  // 申請者本人の反社チェック申請を作成日時の降順で返す。
  async findByRequesterId(props: {
    requesterId: number
    limit: number
    offset: number
  }): Promise<ReadonlyArray<AntisocialCheck> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(antisocialChecks)
        .where(eq(antisocialChecks.requesterId, props.requesterId))
        .orderBy(desc(antisocialChecks.createdAt))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => AntisocialCheck.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load antisocial_checks")
    }
  }

  // 反社チェック申請 id で1件取得する。存在しなければ null。
  async findById(id: string): Promise<AntisocialCheck | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(antisocialChecks)
        .where(eq(antisocialChecks.id, id))

      const row = rows.at(0)

      return row === undefined ? null : AntisocialCheck.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load antisocial_check")
    }
  }

  async create(antisocialCheck: AntisocialCheck): Promise<AntisocialCheck | Error> {
    try {
      await this.c.var.database.insert(antisocialChecks).values({
        id: antisocialCheck.id,
        requesterId: antisocialCheck.requesterId,
        partnerName: antisocialCheck.partnerName,
        partnerAddress: antisocialCheck.partnerAddress,
        representativeName: antisocialCheck.representativeName,
        result: antisocialCheck.result,
        status: antisocialCheck.status,
        createdAt: antisocialCheck.createdAt,
      })

      return antisocialCheck
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save antisocial_check")
    }
  }

  // 反社チェック申請の取引先情報と判定結果を更新する。status が requested でなければ 0 行更新となり null を返す。
  async update(antisocialCheck: AntisocialCheck): Promise<AntisocialCheck | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(antisocialChecks)
        .set({
          partnerName: antisocialCheck.partnerName,
          partnerAddress: antisocialCheck.partnerAddress,
          representativeName: antisocialCheck.representativeName,
          result: antisocialCheck.result,
        })
        .where(
          and(
            eq(antisocialChecks.id, antisocialCheck.id),
            eq(antisocialChecks.status, "requested"),
          ),
        )
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : AntisocialCheck.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update antisocial_check")
    }
  }

  // 反社チェック申請を削除する。status が requested の行のみ対象とする。
  async delete(id: string): Promise<true | null | Error> {
    try {
      const rows = await this.c.var.database
        .delete(antisocialChecks)
        .where(and(eq(antisocialChecks.id, id), eq(antisocialChecks.status, "requested")))
        .returning({ id: antisocialChecks.id })

      return rows.length > 0 ? true : null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete antisocial_check")
    }
  }
}
