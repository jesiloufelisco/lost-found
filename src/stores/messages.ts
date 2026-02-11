// messages.ts
import { supabase } from '@/lib/supabase'
import type { Message } from '@/types/chat'

/**
 * Sends a new message to a conversation and broadcasts it
 */
export async function sendMessage(
  conversationId: string,
  messageText: string,
  userId: string
): Promise<Message> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        message: messageText,
        user_id: userId,
        isread: false, // Explicitly set isread to false for new messages
      })
      .select()
      .single()

    if (error) throw error

    // Broadcast the new message to all subscribers
    const channel = supabase.channel(`conversation_${conversationId}`)
    await channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: data
    })

    return data
  } catch (error) {
    console.error('Error sending message:', error)
    throw new Error('Failed to send message')
  }
}

/**
 * Loads all messages for a conversation
 */
export async function loadMessages(conversationId: string): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error loading messages:', error)
    throw new Error('Failed to load messages')
  }
}

/**
 * Sets up real-time subscription for new messages in a conversation using broadcast
 */
export function setupMessageSubscription(
  conversationId: string,
  onNewMessage: (message: Message) => void,
  currentUserId: string
) {
  const channel = supabase.channel(`conversation_${conversationId}`)

  return channel
    .on(
      'broadcast',
      { event: 'new_message' },
      (payload: any) => {
        // Only trigger callback if message is not from current user
        if (payload.payload.user_id !== currentUserId) {
          onNewMessage(payload.payload as Message)
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload: any) => {
        // Fallback to postgres_changes if broadcast doesn't work
        // Only trigger callback if message is not from current user
        if (payload.new.user_id !== currentUserId) {
          onNewMessage(payload.new as Message)
        }
      }
    )
    .subscribe()
}

/**
 * Broadcasts a message to a conversation channel
 */
export async function broadcastMessage(
  conversationId: string,
  message: Message
): Promise<void> {
  try {
    const channel = supabase.channel(`conversation_${conversationId}`)
    await channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: message
    })
  } catch (error) {
    console.error('Error broadcasting message:', error)
  }
}

/**
 * Broadcasts a typing indicator to a conversation channel
 */
export async function broadcastTyping(
  conversationId: string,
  userId: string,
  userName: string,
  isTyping: boolean
): Promise<void> {
  try {
    const channel = supabase.channel(`conversation_typing_${conversationId}`)
    await channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        user_id: userId,
        user_name: userName,
        is_typing: isTyping,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error broadcasting typing status:', error)
  }
}

/**
 * Sets up a subscription to listen for typing indicators
 */
export function setupTypingSubscription(
  conversationId: string,
  onTypingChange: (payload: { user_id: string; user_name: string; is_typing: boolean }) => void,
  currentUserId: string
) {
  const channel = supabase.channel(`conversation_typing_${conversationId}`)

  return channel
    .on(
      'broadcast',
      { event: 'typing' },
      (payload: any) => {
        // Only trigger callback if typing user is not the current user
        if (payload.payload.user_id !== currentUserId) {
          onTypingChange(payload.payload)
        }
      }
    )
    .subscribe()
}

/**
 * Loads all items from the database
 */
export async function loadItems(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error loading items:', error)
    throw new Error('Failed to load items')
  }
}

/**
 * Counts unread messages for a specific item
 * Returns the total count of messages where isread is false for all conversations related to the item
 * Only counts messages received by the current user (excludes messages sent by currentUserId)
 */
export async function countUnreadMessagesForItem(itemId: number, currentUserId: string): Promise<number> {
  try {
    // First get all conversations for this item
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('item_id', itemId)

    if (convError) throw convError
    if (!conversations || conversations.length === 0) return 0

    // Get conversation IDs
    const conversationIds = conversations.map(conv => conv.id)

    // Count unread messages in these conversations (excluding messages sent by current user)
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('conversation_id', conversationIds)
      .eq('isread', false)
      .neq('user_id', currentUserId) // Only count messages NOT sent by current user

    if (error) throw error
    return count || 0
  } catch (error) {
    console.error('Error counting unread messages for item:', error)
    return 0
  }
}

/**
 * Gets unread message counts for multiple items
 * Returns a map of item_id -> unread_count
 * Only counts messages received by the current user (excludes messages sent by currentUserId)
 */
export async function getUnreadMessageCountsForItems(itemIds: number[], currentUserId: string): Promise<Record<number, number>> {
  try {
    if (itemIds.length === 0) return {}

    // Get all conversations for these items
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, item_id')
      .in('item_id', itemIds)

    if (convError) throw convError
    if (!conversations || conversations.length === 0) return {}

    // Get conversation IDs
    const conversationIds = conversations.map(conv => conv.id)

    // Get all unread messages for these conversations (excluding messages sent by current user)
    const { data: unreadMessages, error: msgError } = await supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', conversationIds)
      .eq('isread', false)
      .neq('user_id', currentUserId) // Only count messages NOT sent by current user

    if (msgError) throw msgError

    // Create a map of conversation_id -> item_id
    const convToItemMap: Record<string, number> = {}
    conversations.forEach(conv => {
      if (conv.item_id) {
        convToItemMap[conv.id] = conv.item_id
      }
    })

    // Count unread messages per item
    const unreadCounts: Record<number, number> = {}
    itemIds.forEach(id => {
      unreadCounts[id] = 0
    })

    if (unreadMessages) {
      unreadMessages.forEach(msg => {
        const itemId = convToItemMap[msg.conversation_id]
        if (itemId) {
          unreadCounts[itemId] = (unreadCounts[itemId] || 0) + 1
        }
      })
    }

    return unreadCounts
  } catch (error) {
    console.error('Error getting unread message counts:', error)
    return {}
  }
}

/**
 * Counts unread messages for a specific conversation
 * Returns the total count of messages where isread is false for a conversation
 * Only counts messages received by the current user (excludes messages sent by currentUserId)
 */
export async function countUnreadMessagesForConversation(conversationId: string, currentUserId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('isread', false)
      .neq('user_id', currentUserId) // Only count messages NOT sent by current user

    if (error) throw error
    return count || 0
  } catch (error) {
    console.error('Error counting unread messages for conversation:', error)
    return 0
  }
}

/**
 * Gets unread message counts for multiple conversations
 * Returns a map of conversation_id -> unread_count
 * Only counts messages received by the current user (excludes messages sent by currentUserId)
 */
export async function getUnreadMessageCountsForConversations(conversationIds: string[], currentUserId: string): Promise<Record<string, number>> {
  try {
    if (conversationIds.length === 0) return {}

    // Get all unread messages for these conversations (excluding messages sent by current user)
    const { data: unreadMessages, error } = await supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', conversationIds)
      .eq('isread', false)
      .neq('user_id', currentUserId) // Only count messages NOT sent by current user

    if (error) throw error

    // Count unread messages per conversation
    const unreadCounts: Record<string, number> = {}
    conversationIds.forEach(id => {
      unreadCounts[id] = 0
    })

    if (unreadMessages) {
      unreadMessages.forEach(msg => {
        unreadCounts[msg.conversation_id] = (unreadCounts[msg.conversation_id] || 0) + 1
      })
    }

    return unreadCounts
  } catch (error) {
    console.error('Error getting unread message counts for conversations:', error)
    return {}
  }
}

/**
 * Marks all messages in a conversation as read
 * Updates isread to true for all messages where the user is NOT the sender
 */
export async function markConversationMessagesAsRead(
  conversationId: string,
  currentUserId: string
): Promise<number> {
  try {
    console.log('Attempting to mark messages as read for conversation:', conversationId, 'User:', currentUserId)

    // First, let's check how many unread messages exist
    const { data: unreadMessages, error: checkError } = await supabase
      .from('messages')
      .select('id, user_id, isread')
      .eq('conversation_id', conversationId)
      .neq('user_id', currentUserId)
      .eq('isread', false)

    if (checkError) {
      console.error('Error checking unread messages:', checkError)
      throw checkError
    }

    console.log('Found unread messages to mark as read:', unreadMessages?.length || 0, unreadMessages)

    if (!unreadMessages || unreadMessages.length === 0) {
      console.log('No unread messages to update')
      return 0
    }

    // Update the messages
    const { data, error, count } = await supabase
      .from('messages')
      .update({ isread: true })
      .eq('conversation_id', conversationId)
      .neq('user_id', currentUserId)
      .eq('isread', false)
      .select()

    if (error) {
      console.error('Error updating messages:', error)
      throw error
    }

    console.log('Successfully marked messages as read. Updated count:', data?.length || 0, 'Data:', data)
    return data?.length || 0
  } catch (error) {
    console.error('Error marking messages as read:', error)
    throw new Error('Failed to mark messages as read: ' + (error as any).message)
  }
}

/**
 * Verifies if messages were successfully marked as read
 * Diagnostic function to check database state
 */
export async function verifyMessagesMarkedAsRead(
  conversationId: string,
  currentUserId: string
): Promise<{ total: number; unread: number; read: number }> {
  try {
    // Get all messages in the conversation (excluding current user's messages)
    const { data: allMessages, error: allError } = await supabase
      .from('messages')
      .select('id, user_id, isread')
      .eq('conversation_id', conversationId)
      .neq('user_id', currentUserId)

    if (allError) throw allError

    const total = allMessages?.length || 0
    const unread = allMessages?.filter(m => !m.isread).length || 0
    const read = allMessages?.filter(m => m.isread).length || 0

    console.log('Message verification for conversation:', conversationId)
    console.log('Total messages (from others):', total)
    console.log('Unread messages:', unread)
    console.log('Read messages:', read)

    return { total, unread, read }
  } catch (error) {
    console.error('Error verifying messages:', error)
    return { total: 0, unread: 0, read: 0 }
  }
}

/**
 * Sets up a real-time subscription for all messages in the database
 * Useful for monitoring message changes across all conversations
 */
export function setupMessagesRealtimeSubscription(
  onMessageInserted: (message: Message) => void,
  onMessageUpdated: (message: Message) => void
) {
  const channel = supabase.channel('all-messages-changes')

  return channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        onMessageInserted(payload.new as Message)
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        onMessageUpdated(payload.new as Message)
      }
    )
    .subscribe()
}

/**
 * Updates unread count for a specific conversation
 * Queries the database to count unread messages and returns the count
 */
export async function updateUnreadCountForConversation(
  conversationId: string,
  currentUserId: string
): Promise<number> {
  try {
    // Count unread messages for this conversation (excluding current user's messages)
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('isread', false)
      .neq('user_id', currentUserId) // Only count messages NOT sent by current user

    if (error) throw error
    return count || 0
  } catch (error) {
    console.error('Error updating unread count:', error)
    return 0
  }
}

/**
 * Gets the total unread message count across all items for the current user
 * Used for showing a badge in the sidebar Support Inbox menu item
 */
export async function getTotalUnreadMessageCount(currentUserId: string): Promise<number> {
  try {
    // Get all conversations
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id')

    if (convError) throw convError
    if (!conversations || conversations.length === 0) return 0

    // Get conversation IDs
    const conversationIds = conversations.map(conv => conv.id)

    // Count all unread messages across all conversations (excluding current user's messages)
    const { count, error: msgError } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('conversation_id', conversationIds)
      .eq('isread', false)
      .neq('user_id', currentUserId) // Only count messages NOT sent by current user

    if (msgError) throw msgError
    return count || 0
  } catch (error) {
    console.error('Error getting total unread message count:', error)
    return 0
  }
}
