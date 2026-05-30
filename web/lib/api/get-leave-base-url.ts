// leave ドメインの baseUrl 解決。共有基盤 (get-api-client / create-api-client) は触らず、
// 同じ env を参照する leave 専用の薄いヘルパとして独立させる。
export function getLeaveBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"
}
