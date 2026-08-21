import { CertificateRequest } from "@/contexts/certificate-request/domain/entities/certificate-request.entity"
import type { Context } from "@/env"
import { certificateRequests } from "@/contexts/certificate-request/infrastructure/schema/certificate-request"
import { and, desc, eq } from "drizzle-orm"

export class CertificateRequestRepository {
  constructor(private readonly c: Context) {}

  /** 依頼者本人の証明書発行依頼を作成日時の降順で返す。 */
  async findByRequesterId(props: {
    requesterId: number
    limit: number
    offset: number
  }): Promise<ReadonlyArray<CertificateRequest> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(certificateRequests)
        .where(eq(certificateRequests.requesterId, props.requesterId))
        .orderBy(desc(certificateRequests.createdAt))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => CertificateRequest.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load certificate_requests")
    }
  }

  /** 証明書発行依頼 id で1件取得する。存在しなければ null。 */
  async findById(id: string): Promise<CertificateRequest | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(certificateRequests)
        .where(eq(certificateRequests.id, id))

      const row = rows.at(0)

      return row === undefined ? null : CertificateRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load certificate_request")
    }
  }

  async create(certificateRequest: CertificateRequest): Promise<CertificateRequest | Error> {
    try {
      await this.c.var.database.insert(certificateRequests).values({
        id: certificateRequest.id,
        requesterId: certificateRequest.requesterId,
        certificateType: certificateRequest.certificateType,
        submitTo: certificateRequest.submitTo,
        neededBy: certificateRequest.neededBy,
        note: certificateRequest.note,
        status: certificateRequest.status,
        createdAt: certificateRequest.createdAt,
      })

      return certificateRequest
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save certificate_request")
    }
  }

  /** 証明書発行依頼の種別・提出先・希望日・備考を更新する。status が requested でなければ 0 行更新となり null を返す。 */
  async update(certificateRequest: CertificateRequest): Promise<CertificateRequest | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(certificateRequests)
        .set({
          certificateType: certificateRequest.certificateType,
          submitTo: certificateRequest.submitTo,
          neededBy: certificateRequest.neededBy,
          note: certificateRequest.note,
        })
        .where(
          and(
            eq(certificateRequests.id, certificateRequest.id),
            eq(certificateRequests.status, "requested"),
          ),
        )
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : CertificateRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update certificate_request")
    }
  }

  /** status を fromStatus から toStatus へ遷移する。行が fromStatus でなければ 0 行更新となり null を返す。 */
  async updateStatus(props: {
    id: string
    fromStatus: string
    toStatus: string
  }): Promise<CertificateRequest | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(certificateRequests)
        .set({ status: props.toStatus })
        .where(
          and(
            eq(certificateRequests.id, props.id),
            eq(certificateRequests.status, props.fromStatus),
          ),
        )
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : CertificateRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error
        ? error
        : new Error("failed to update certificate_request status")
    }
  }

  /** 証明書発行依頼を削除する。status が requested の行のみ対象とする。 */
  async delete(id: string): Promise<true | null | Error> {
    try {
      const rows = await this.c.var.database
        .delete(certificateRequests)
        .where(and(eq(certificateRequests.id, id), eq(certificateRequests.status, "requested")))
        .returning({ id: certificateRequests.id })

      return rows.length > 0 ? true : null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete certificate_request")
    }
  }
}
