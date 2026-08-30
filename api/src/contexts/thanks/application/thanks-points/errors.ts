import type { ThanksRedemption } from "@/contexts/thanks/domain/entities/thanks-redemption.entity"

/**
 * 確定はできたが在庫減算だけ失敗した結果。交換は確定済みなので巻き戻さず、
 * 追跡できるよう redemption と原因を呼び出し側へ表面化する（握りつぶさない）。
 * これはエラーではなく「在庫警告つきの成功」なので ApplicationError には含めない。
 */
export type FulfilledWithStockError = {
  reason: "fulfilled_with_stock_error"
  redemption: ThanksRedemption
  stockError: Error
}
