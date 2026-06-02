// rooms ドメインの手書き型。api 側 zod スキーマ (api/src/room) と疎結合に保つため
// z.infer を import せず、レスポンス/リクエストの shape をここで独立に定義する。

// GET /rooms/availability のクエリ条件。期間と最低定員で空き状況を絞り込む。
// start_at / end_at は ISO 文字列。capacity は 0 でフィルタ無し。
export type RoomAvailabilitySearch = {
  startAt: string | null
  endAt: string | null
  capacity: number | null
}

// availability レスポンス要素に含まれる会議室サマリ。
export type RoomSummary = {
  id: number
  name: string
  capacity: number
}

// availability レスポンスの衝突予約。重複時に purpose を表示する。
export type RoomReservationConflict = {
  purpose: string | null
}

// GET /rooms/availability のレスポンス要素 (toRoomAvailability の出力)。
export type RoomAvailability = {
  room: RoomSummary
  available: boolean
  conflicts: ReadonlyArray<RoomReservationConflict>
}

// POST /rooms/reservations のリクエストボディ。
export type RoomReservationCreateRequest = {
  room_id: number
  start_at: string
  end_at: string
  purpose: string | null
}

// POST /rooms/reservations のレスポンス (作成された reservation エンティティ)。
export type RoomReservationCreated = {
  id: number
  roomId: number
  reserverId: number
  startAt: string
  endAt: string
  purpose: string | null
}

// GET /rooms/reservations/me と /rooms/reservations/:id のレスポンス要素。api は snake_case で返す。
export type RoomReservationResponse = {
  id: string
  room_id: number
  reserver_id: number
  start_at: string
  end_at: string
  purpose: string | null
}

// PUT /rooms/reservations/:id のリクエストボディ。
export type RoomReservationUpdateRequest = {
  start_at: string
  end_at: string
  purpose: string | null
}
