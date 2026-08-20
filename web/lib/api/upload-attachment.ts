import { getServerSession } from "@/lib/auth/get-server-session"

export type UploadedAttachment = {
  id: string
  file_name: string
  content_type: string
  byte_size: number
}

/**
 * POST /attachments。添付本体を API へ預け、attachment_id を得る。
 * 本体は Server Action がブラウザから受け取り、この関数が API へ中継する
 * （API は暗号化して保管するため、ブラウザから storage へ直接置く経路は持たない）。
 */
export async function uploadAttachment(file: File): Promise<UploadedAttachment | Error> {
  const token = await getServerSession()

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:18787"

  const headers: Record<string, string> = { "X-Open-Karte-Client": "web" }

  if (token !== null) {
    headers.Authorization = `Bearer ${token}`
  }

  const form = new FormData()

  form.set("file", file)

  try {
    const response = await fetch(new URL("/attachments", baseUrl), {
      method: "POST",
      headers,
      body: form,
    })

    if (response.status >= 400) {
      return new Error(
        response.status === 413
          ? "添付が大きすぎます（25MB まで）"
          : "添付をアップロードできませんでした",
      )
    }

    const body: unknown = await response.json()

    if (typeof body !== "object" || body === null || !("id" in body)) {
      return new Error("添付の応答を解釈できませんでした")
    }

    const record: Record<string, unknown> = { ...body }

    return {
      id: String(record.id),
      file_name: String(record.file_name),
      content_type: String(record.content_type),
      byte_size: Number(record.byte_size),
    }
  } catch {
    return new Error("添付をアップロードできませんでした")
  }
}
