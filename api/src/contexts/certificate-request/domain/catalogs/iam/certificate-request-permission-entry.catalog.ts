import type { CertificateRequestPermissionKey } from "@/contexts/certificate-request/domain/catalogs/iam/certificate-request-permission-key.catalog"

type PermissionEntry = {
  key: CertificateRequestPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * CertificateRequest が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const CERTIFICATE_REQUEST_PERMISSION_ENTRIES = [
  {
    key: "certificate_request:manage",
    category: "certificate-request",
    featureKey: null,
    description: "証明書発行依頼の状態を代理で進める",
  },
  {
    key: "certificate_request:read:all",
    category: "certificate-request",
    featureKey: null,
    description: "全社の証明書発行依頼を横断で閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
