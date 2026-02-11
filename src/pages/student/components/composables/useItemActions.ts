// useItemActions.ts
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Message } from '@/types/chat'
import { 
  createItem, 
  markItemAsClaimed, 
  type NewItemForm 
} from '@/stores/items'
import {
  loadExistingConversation,
  createConversation,
  getUserConversations as getUserConversationsFromDb
} from '@/stores/conversation'
import type { Conversation } from '@/types/chat'
import {
  sendMessage as sendMessageToDb,
  loadMessages as loadMessagesFromDb,
  setupMessageSubscription
} from '@/stores/messages'

export const useItemActions = (refreshData?: () => Promise<void>) => {
  const postingItem = ref(false)
  const showPostDialog = ref(false)
  const startingConversation = ref<Set<number>>(new Set())
  
  const newItemForm = ref<NewItemForm>({
    title: '',
    description: '',
    status: 'lost'
  })

  /**
   * Posts a new missing item
   */
  const postMissingItem = async () => {
    if (!newItemForm.value.title || !newItemForm.value.description) {
      return
    }

    postingItem.value = true

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('User not authenticated')
      }

      await createItem(newItemForm.value, user.id)

      // Reset form
      newItemForm.value = {
        title: '',
        description: '',
        status: 'lost'
      }
      showPostDialog.value = false

      if (refreshData) await refreshData()

    } catch (error) {
      console.error('Error posting item:', error)
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
      alert(`Error posting item: ${errorMessage}`)
    } finally {
      postingItem.value = false
    }
  }

  /**
   * Contact function - initiates conversation with admin who posted the item
   */
  const contactAdmin = async (itemId: number, adminId: string) => {
    startingConversation.value.add(itemId)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      // Check if conversation already exists
      const existingConversation = await loadExistingConversation(
        itemId,
        user.id,
        adminId
      )

      if (existingConversation) {
        return { conversation: existingConversation, isNew: false }
      }

      // Create new conversation
      const newConversation = await createConversation(itemId, user.id, adminId)
      return { conversation: newConversation, isNew: true }

    } catch (error) {
      console.error('Error contacting admin:', error)
      throw error
    } finally {
      startingConversation.value.delete(itemId)
    }
  }

  /**
   * Load or create conversation between user and admin
   */
  const loadOrCreateConversation = async (itemId: number, adminId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      // Check if conversation already exists
      const existingConversation = await loadExistingConversation(
        itemId,
        user.id,
        adminId
      )

      if (existingConversation) {
        return { conversation: existingConversation, isNew: false }
      }

      // Create new conversation
      const newConversation = await createConversation(itemId, user.id, adminId)
      return { conversation: newConversation, isNew: true }

    } catch (error) {
      console.error('Error loading/creating conversation:', error)
      throw error
    }
  }

  /**
   * Load messages for a conversation
   */
  const loadMessages = async (conversationId: string): Promise<Message[]> => {
    try {
      return await loadMessagesFromDb(conversationId)
    } catch (error) {
      console.error('Error loading messages:', error)
      throw error
    }
  }

  /**
   * Send message in conversation
   */
  const sendMessage = async (
    conversationId: string, 
    message: string, 
    attachImage?: string
  ): Promise<Message> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      // Note: attachImage parameter is included but not used in the current implementation
      // You may need to modify sendMessageToDb to support attachments
      if (attachImage) {
        console.warn('Image attachments are not yet implemented in sendMessage')
      }

      return await sendMessageToDb(conversationId, message, user.id)
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  }

  /**
   * Get conversations for current user
   */
  const getUserConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      return await getUserConversationsFromDb(user.id)
    } catch (error) {
      console.error('Error fetching conversations:', error)
      throw error
    }
  }

  /**
   * Subscribe to real-time message updates
   */
  const subscribeToMessages = (
    conversationId: string, 
    callback: (message: Message) => void
  ) => {
    // Get current user ID for filtering
    const getCurrentUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user?.id || ''
    }

    getCurrentUserId().then(userId => {
      setupMessageSubscription(conversationId, callback, userId)
    })

    // Return the subscription channel for cleanup
    return supabase.channel(`messages:${conversationId}`)
  }

  /**
   * Mark item as claimed by current user
   */
  const markAsClaimed = async (itemId: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('User not authenticated')
      }

      await markItemAsClaimed(itemId, user.id)

      if (refreshData) await refreshData()
    } catch (error) {
      console.error('Error marking item as claimed:', error)
      alert('Error updating item status')
    }
  }

  return {
    postingItem,
    showPostDialog,
    startingConversation,
    newItemForm,
    postMissingItem,
    contactAdmin,
    loadOrCreateConversation,
    loadMessages,
    sendMessage,
    getUserConversations,
    subscribeToMessages,
    markAsClaimed,
  }
}

// Export types for use in other files
export type { NewItemForm, Message }