# CHANGELOG

## 2026-09-11

### 修正

- 休暇の承認・却下通知を判断と同時に予約し、配信失敗時に再送する。定期配送には`LEAVE_NOTIFICATION_SERVICE_ACCOUNT_ID`と対応するService権限の設定が必要（#1353）。
