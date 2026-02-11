// types/chat.ts
export interface Item {
  id: number
  title: string
  description?: string
  status: 'lost' | 'found'
  user_id: string
}

export interface User {
  id: string
  email: string
  full_name?: string
}

export interface Conversation {
  id: string
  item_id: number | null // null for admin support conversations
  sender_id: string
  receiver_id: string
  created_at: string
  sender?: User
  sender_profile?: {
    full_name?: string
    email: string
  }
  item?: Item | null // Include item details when available
  latest_message?: {
    message: string
    created_at: string
  }
  message_count?: number
  messages?: Message[]
}

export interface Message {
  id: string
  conversation_id: string
  message: string
  user_id: string
  created_at: string
  sender_id?: string
  isread?: boolean
}

export interface SendMessagePayload {
  conversationId: string
  message: string
  userId: string
}

// Admin Support specific types
export interface AdminSupportConversation extends Conversation {
  item_id: null // Always null for admin support
  student_name?: string
  student_email?: string
  unread_count?: number
}

export interface AdminSupportMessage extends Message {
  is_from_admin: boolean
  read?: boolean
}
