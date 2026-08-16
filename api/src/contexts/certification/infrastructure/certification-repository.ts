import { Certification } from "@/contexts/certification/domain/certification.entity"
import type { Context } from "@/env"
import { certifications } from "@/contexts/certification/infrastructure/schema/certification"
import { asc, eq } from "drizzle-orm"

export class CertificationRepository {
  constructor(private readonly c: Context) {}

  /** 資格マスタを code の昇順で全件返す。 */
  async findAll(): Promise<ReadonlyArray<Certification> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(certifications)
        .orderBy(asc(certifications.code))

      return rows.map((row) => Certification.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load certifications")
    }
  }

  /** id で 1 件取得する。存在しなければ null。 */
  async findById(id: number): Promise<Certification | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(certifications)
        .where(eq(certifications.id, id))

      const row = rows.at(0)

      return row === undefined ? null : Certification.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load certification")
    }
  }

  /** code で 1 件取得する。存在しなければ null。 */
  async findByCode(code: string): Promise<Certification | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(certifications)
        .where(eq(certifications.code, code))

      const row = rows.at(0)

      return row === undefined ? null : Certification.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load certification")
    }
  }

  /** 新規マスタを INSERT する。code は UNIQUE 制約があり、重複時は Error を返す。 */
  async create(props: {
    code: string
    name: string
    issuer: string | null
    description: string | null
    createdAt: string
  }): Promise<Certification | Error> {
    try {
      const rows = await this.c.var.database
        .insert(certifications)
        .values({
          code: props.code,
          name: props.name,
          issuer: props.issuer,
          description: props.description,
          createdAt: props.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to save certification")
        : Certification.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save certification")
    }
  }

  /** 名称・発行元・説明を更新する。対象が無ければ null。 */
  async update(certification: Certification): Promise<Certification | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(certifications)
        .set({
          name: certification.name,
          issuer: certification.issuer,
          description: certification.description,
        })
        .where(eq(certifications.id, certification.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Certification.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update certification")
    }
  }
}
