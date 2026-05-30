// api/src の baseUrl 解決。get-api-client.ts と同じ env を参照するが共有基盤は触らない。
export function getExpenseBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"
}
