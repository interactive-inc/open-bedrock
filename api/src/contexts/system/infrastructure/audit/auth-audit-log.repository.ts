import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/infrastructure/configuration/system-context"
import { redactSensitiveValue } from "@/lib/security/redact-sensitive-value"
import { IdValue } from "@/lib/identity/id.value"
import type { WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
import { auditLogs } from "@/contexts/system/infrastructure/schema/system-runtime"

type Props = Readonly<{
  userId: string
  role: string
  action: string
  resourceId: string | null
  metadata: Record<string, unknown> | null
}>

/**
 * 認証イベント (login / logout / 初期password / 切替 / register 等) を監査ログへ記録する。
 * auth 系ルートは auditMiddleware より前に登録されており本ミドルウェアを通らないため、
 * 各 application がこの repository 経由で明示的に書き込む。resourceType は常に "auth" 固定。
 *
 * best-effort。通常のpassword変更・resetなど必須監査へ移行済みのmutationは別のD1 batch
 * appenderを使う。残る互換経路では書き込みに失敗しても throw せずconsole.errorに留め、呼び出し元の認証操作
 * (ログイン成功のレスポンス等) は巻き戻さない。metadata は明示オブジェクトを渡す前提だが、
 * 平文パスワード / トークンの取りこぼしを防ぐため domain policy を通してから直列化する。
 */
export class AuthAuditLogRepository {
  constructor(private readonly c: SystemDatabaseContext & SystemClockContext) {}

  async write(entity: WriteOperationEntity<"record", Props>): Promise<void> {
    const props = entity.props
    const redacted = props.metadata === null ? null : redactSensitiveValue(props.metadata)

    const metadata = redacted === null ? null : JSON.stringify(redacted)

    try {
      await this.c.var.database.insert(auditLogs).values({
        id: IdValue.create().toString(),
        userId: props.userId,
        role: props.role,
        action: props.action,
        resourceType: "auth",
        resourceId: props.resourceId,
        metadata,
        createdAt: this.c.var.now(),
      })
    } catch (error) {
      console.error("auth audit write failed", error)
    }
  }
}
