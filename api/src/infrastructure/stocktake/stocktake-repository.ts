import { Stocktake, stocktakeRowSchema } from "@/domain/stocktake/stocktake.entity"
import type { Context } from "@/env"
import { parseD1Row } from "@/infrastructure/shared/parse-d1-row"
import { assets, stocktakeItems, stocktakes } from "@/schema"
import { and, asc, count, desc, eq, isNotNull } from "drizzle-orm"

export type StocktakeItemDetail = {
  assetCode: string
  assetName: string
  kind: string
  checkedAt: string | null
  checkerEmployeeId: number | null
  locationNote: string | null
}

export type StocktakeCounts = {
  checkedCount: number
  totalCount: number
}

export class StocktakeRepository {
  constructor(private readonly c: Context) {}

  // 棚卸しセッションを作成し、廃棄されていない全資産を対象アイテムとして展開する。
  // セッション作成とアイテム展開を D1 batch で同一トランザクションにまとめる。
  async createWithItems(stocktake: Stocktake): Promise<Stocktake | Error> {
    try {
      const targetAssets = await this.c.var.database
        .select({ code: assets.code })
        .from(assets)
        .where(eq(assets.status, "in_stock"))

      const lentAssets = await this.c.var.database
        .select({ code: assets.code })
        .from(assets)
        .where(eq(assets.status, "lent"))

      const targetCodes = targetAssets.concat(lentAssets).map((row) => row.code)

      const statements = [
        this.c.env.DB.prepare(
          `
          INSERT INTO stocktakes (id, name, target_date, status, created_at, closed_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6)
          `,
        ).bind(
          stocktake.id,
          stocktake.name,
          stocktake.targetDate,
          stocktake.status,
          stocktake.createdAt,
          stocktake.closedAt,
        ),
        ...targetCodes.map((code) =>
          this.c.env.DB.prepare(
            `
            INSERT INTO stocktake_items (stocktake_id, asset_code, checked_at, checker_employee_id, location_note)
            VALUES (?1, ?2, NULL, NULL, NULL)
            `,
          ).bind(stocktake.id, code),
        ),
      ]

      await this.c.env.DB.batch(statements)

      return stocktake
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to create stocktake")
    }
  }

  async findById(id: string): Promise<Stocktake | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(stocktakes)
        .where(eq(stocktakes.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Stocktake.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load stocktake")
    }
  }

  async listByStatus(props: {
    status: string | null
    limit: number
    offset: number
  }): Promise<ReadonlyArray<Stocktake> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(stocktakes)
        .where(props.status === null ? undefined : eq(stocktakes.status, props.status))
        .orderBy(desc(stocktakes.createdAt))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => Stocktake.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load stocktakes")
    }
  }

  async countByStatus(status: string | null): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ total: count() })
        .from(stocktakes)
        .where(status === null ? undefined : eq(stocktakes.status, status))

      return rows.at(0)?.total ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count stocktakes")
    }
  }

  async countsFor(id: string): Promise<StocktakeCounts | Error> {
    try {
      const totalRows = await this.c.var.database
        .select({ total: count() })
        .from(stocktakeItems)
        .where(eq(stocktakeItems.stocktakeId, id))

      const checkedRows = await this.c.var.database
        .select({ total: count() })
        .from(stocktakeItems)
        .where(and(eq(stocktakeItems.stocktakeId, id), isNotNull(stocktakeItems.checkedAt)))

      return {
        checkedCount: checkedRows.at(0)?.total ?? 0,
        totalCount: totalRows.at(0)?.total ?? 0,
      }
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count stocktake items")
    }
  }

  async itemsFor(id: string): Promise<ReadonlyArray<StocktakeItemDetail> | Error> {
    try {
      const rows = await this.c.var.database
        .select({
          assetCode: stocktakeItems.assetCode,
          assetName: assets.name,
          kind: assets.kind,
          checkedAt: stocktakeItems.checkedAt,
          checkerEmployeeId: stocktakeItems.checkerEmployeeId,
          locationNote: stocktakeItems.locationNote,
        })
        .from(stocktakeItems)
        .leftJoin(assets, eq(assets.code, stocktakeItems.assetCode))
        .where(eq(stocktakeItems.stocktakeId, id))
        .orderBy(asc(stocktakeItems.assetCode))

      return rows.map((row) => ({
        assetCode: row.assetCode,
        assetName: row.assetName ?? "",
        kind: row.kind ?? "",
        checkedAt: row.checkedAt,
        checkerEmployeeId: row.checkerEmployeeId,
        locationNote: row.locationNote,
      }))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load stocktake items")
    }
  }

  // セッションが open のときだけ、対象アイテムに現物確認を記録する。
  // 更新できたら "checked"、対象アイテムが無ければ "item_not_found"、
  // セッションが open でなければ "not_open" を返す。
  async checkItem(props: {
    stocktakeId: string
    assetCode: string
    checkedAt: string
    checkerEmployeeId: number
    locationNote: string | null
  }): Promise<"checked" | "item_not_found" | "not_open" | Error> {
    try {
      const sessionRows = await this.c.var.database
        .select({ status: stocktakes.status })
        .from(stocktakes)
        .where(eq(stocktakes.id, props.stocktakeId))
        .limit(1)

      const session = sessionRows.at(0)

      if (session === undefined) {
        return "item_not_found"
      }

      if (session.status !== "open") {
        return "not_open"
      }

      const updated = await this.c.env.DB.prepare(
        `
        UPDATE stocktake_items
        SET checked_at = ?3, checker_employee_id = ?4, location_note = ?5
        WHERE stocktake_id = ?1
          AND asset_code = ?2
        `,
      )
        .bind(
          props.stocktakeId,
          props.assetCode,
          props.checkedAt,
          props.checkerEmployeeId,
          props.locationNote,
        )
        .run()

      if (updated.meta.changes === 0) {
        return "item_not_found"
      }

      return "checked"
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to check stocktake item")
    }
  }

  // open のセッションだけを closed に更新する。0 行更新なら null（open でない）。
  async closeIfOpen(props: { id: string; closedAt: string }): Promise<Stocktake | null | Error> {
    try {
      const result = await this.c.env.DB.prepare(
        `
        UPDATE stocktakes
        SET status = 'closed', closed_at = ?2
        WHERE id = ?1
          AND status = 'open'
        RETURNING
          id,
          name,
          target_date AS targetDate,
          status,
          created_at AS createdAt,
          closed_at AS closedAt
        `,
      )
        .bind(props.id, props.closedAt)
        .all()

      const row = parseD1Row(result, stocktakeRowSchema)

      if (row instanceof Error) {
        return row
      }

      if (row === undefined) {
        return null
      }

      return Stocktake.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to close stocktake")
    }
  }
}
