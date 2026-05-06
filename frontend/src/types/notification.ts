export interface AppNotification {
  id: number
  event_key: string
  title: string
  message: string
  entity_type: string | null
  entity_id: string | null
  route: string | null
  meta: Record<string, unknown>
  read_at: string | null
  created_at: string | null
}

export interface NotificationListResponse {
  data: AppNotification[]
  meta: {
    unread_count: number
  }
}
