// 月次の贈与原資の既定額。業務上の既定値・要調整。
// 本 Task では全社員一律 400pt/月。役割別配分は将来拡張の余地として一律にしている。
// 当月 budget レコードが無い場合はこの額で遅延生成する（月初バッチに依存しない）。
export const monthlyBudgetPoints = 400

// ポイントの上限。極端に大きい値（桁あふれ・誤入力）を弾くための業務上の上限・要調整。
export const maxPointsPerThanks = 10000

// 交換コストの上限。カタログ登録時の誤入力・極大値を弾くための業務上の上限・要調整。
export const maxRewardPointCost = 1000000
