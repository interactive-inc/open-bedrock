/**
 * 役職を指定するには配属先部署が必要か判定する純粋関数。
 * 発令の assignment は部署を必須に持ち、部署が無いと役職の置き場が無く黙って消える。
 * 部署なし + 役職ありの組合せを true として弾く。
 */
export function positionRequiresDepartment(
  departmentCode: string | null,
  positionCode: string | null,
): boolean {
  return positionCode !== null && departmentCode === null
}
