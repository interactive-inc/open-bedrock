/** 直前の更新が0件ならD1 batch全体をrollbackさせるguard statementを返す。 */
export function abortWhenPreviousStatementChangedNoRows(db: D1Database): D1PreparedStatement {
  return db.prepare("SELECT CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END AS ok")
}
