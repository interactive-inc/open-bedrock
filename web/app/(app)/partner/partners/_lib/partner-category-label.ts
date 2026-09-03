/** 取引先の分類コードを日本語ラベルへ変換する。未知の値・null はハイフンを返す。 */
export function partnerCategoryLabel(category: string | null): string {
  if (category === "customer") {
    return "顧客"
  }

  if (category === "supplier") {
    return "仕入先"
  }

  if (category === "other") {
    return "その他"
  }

  return "-"
}
