// pages/admin/components/composables/useAdminSupportInbox.ts
import { ref, onUnmounted, nextTick } from 'vue'
import { useToast } from 'vue-toastification'
import type { Conversation, Message } from '@/types/chat'
import {
  getAllAdminSupportConversations,
  setupAdminSupportConversationsSubscription
} from '@/stores/adminSupport'
import {
  loadMessages,
  sendMessage,
  setupMessageSubscription,
  getUnreadMessageCountsForConversations,
  markConversationMessagesAsRead,
  verifyMessagesMarkedAsRead,
  broadcastTyping,
  setupTypingSubscription
} from '@/stores/messages'

export function useAdminSupportInbox(currentUser: any) {
  const toast = useToast()

  // State
  const showInbox = ref(false)
  const supportConversations = ref<Conversation[]>([])
  const selectedConversation = ref<Conversation | null>(null)
  const messages = ref<Message[]>([])
  const newMessage = ref('')
  const loadingConversations = ref(false)
  const loadingMessages = ref(false)
  const sendingMessage = ref(false)
  const unreadCounts = ref<Record<string, number>>({})
  
  // Typing indicator state
  const isOtherUserTyping = ref(false)
  const otherUserTypingName = ref('')
  const typingTimeout = ref<NodeJS.Timeout | null>(null)
  // Track typing status for each conversation
  const conversationTypingStatus = ref<Record<string, { isTyping: boolean; userName: string }>>({})
  const conversationTypingTimeouts = ref<Record<string, NodeJS.Timeout>>({})

  // Pagination state
  const currentPage = ref(1)
  const pageSize = ref(10)
  const totalCount = ref(0)
  const totalPages = ref(0)

  let messageSubscription: any = null
  let conversationsSubscription: any = null
  let typingSubscription: any = null
  // Track typing subscriptions for all conversations
  let typingSubscriptions: Map<string, any> = new Map()
  let currentConversationId: string | null = null

  // Helper to scroll messages to bottom
  const scrollToBottom = () => {
    nextTick(() => {
      const container = document.querySelector('.admin-support-messages-container')
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    })
  }

  // Handle typing indicator
  const handleTyping = async () => {
    if (!selectedConversation.value || !currentUser.value) return

    const userName = currentUser.value.user_metadata?.full_name || 
                     currentUser.value.email || 
                     'Admin'

    // Broadcast that user is typing
    await broadcastTyping(
      selectedConversation.value.id,
      currentUser.value.id,
      userName,
      true
    )

    // Clear existing timeout
    if (typingTimeout.value) {
      clearTimeout(typingTimeout.value)
    }

    // Set timeout to stop typing indicator after 3 seconds
    typingTimeout.value = setTimeout(async () => {
      if (selectedConversation.value && currentUser.value) {
        await broadcastTyping(
          selectedConversation.value.id,
          currentUser.value.id,
          userName,
          false
        )
      }
    }, 3000)
  }

  // Setup typing subscription
  const setupTypingSubscriptionForConversation = (conversationId: string) => {
    if (!currentUser.value) return

    console.log('Setting up typing subscription for conversation:', conversationId)

    const subscription = setupTypingSubscription(
      conversationId,
      (payload) => {
        console.log('Typing event received:', payload)
        
        // Update typing status for this specific conversation
        conversationTypingStatus.value[conversationId] = {
          isTyping: payload.is_typing,
          userName: payload.user_name
        }
        
        // If this is the selected conversation, also update the main typing state
        if (selectedConversation.value?.id === conversationId) {
          isOtherUserTyping.value = payload.is_typing
          otherUserTypingName.value = payload.user_name
        }

        // Clear existing timeout for this conversation
        if (conversationTypingTimeouts.value[conversationId]) {
          clearTimeout(conversationTypingTimeouts.value[conversationId])
        }

        // Auto-hide typing indicator after 5 seconds
        if (payload.is_typing) {
          conversationTypingTimeouts.value[conversationId] = setTimeout(() => {
            conversationTypingStatus.value[conversationId] = {
              isTyping: false,
              userName: ''
            }
            // Also clear main typing state if this is the selected conversation
            if (selectedConversation.value?.id === conversationId) {
              isOtherUserTyping.value = false
              otherUserTypingName.value = ''
            }
          }, 5000)
        }
      },
      currentUser.value.id
    )

    // Store subscription for later cleanup
    typingSubscriptions.set(conversationId, subscription)
  }

  // Load all admin support conversations with pagination
  const loadSupportConversations = async (page: number = currentPage.value) => {
    loadingConversations.value = true
    try {
      const result = await getAllAdminSupportConversations(page, pageSize.value)
      supportConversations.value = result.conversations
      totalCount.value = result.totalCount
      totalPages.value = result.totalPages
      currentPage.value = result.currentPage
      console.log('Loaded support conversations:', result.conversations.length, 'Total:', result.totalCount)
      
      // Load unread counts for all conversations (only if user is logged in)
      const conversationIds = result.conversations.map(conv => conv.id)
      if (conversationIds.length > 0 && currentUser.value) {
        unreadCounts.value = await getUnreadMessageCountsForConversations(conversationIds, currentUser.value.id)
        
        // Setup typing subscriptions for all conversations
        conversationIds.forEach(convId => {
          // Only setup if not already subscribed
          if (!typingSubscriptions.has(convId)) {
            setupTypingSubscriptionForConversation(convId)
          }
        })
      }
    } catch (error) {
      console.error('Error loading support conversations:', error)
      toast.error('Failed to load support conversations')
      supportConversations.value = []
    } finally {
      loadingConversations.value = false
    }
  }

  // Select a conversation and load its messages
  const selectConversation = async (conversation: Conversation) => {
    console.log('Selecting support conversation:', conversation.id)

    // Cleanup previous message subscription
    if (messageSubscription) {
      messageSubscription.unsubscribe()
      messageSubscription = null
    }

    // Update typing state for the newly selected conversation
    const typingStatus = conversationTypingStatus.value[conversation.id]
    if (typingStatus && typingStatus.isTyping) {
      isOtherUserTyping.value = true
      otherUserTypingName.value = typingStatus.userName
    } else {
      isOtherUserTyping.value = false
      otherUserTypingName.value = ''
    }

    // Clear and set new conversation
    messages.value = []
    selectedConversation.value = conversation
    currentConversationId = conversation.id

    // Load messages first
    await loadConversationMessages(conversation.id)

    // Mark messages as read (only messages from other users) after messages are loaded
    if (currentUser.value) {
      try {
        console.log('Marking messages as read for conversation:', conversation.id, 'Current user:', currentUser.value.id)
        const updatedCount = await markConversationMessagesAsRead(conversation.id, currentUser.value.id)
        console.log('Marked', updatedCount, 'messages as read')
        
        // Verify the update
        const verification = await verifyMessagesMarkedAsRead(conversation.id, currentUser.value.id)
        console.log('Verification result:', verification)
        
        // Update unread count for this conversation to 0
        if (updatedCount > 0 || verification.unread === 0) {
          unreadCounts.value[conversation.id] = 0
          console.log('Updated unread count to 0 for conversation:', conversation.id)
        }
      } catch (error) {
        console.error('Error marking messages as read:', error)
        toast.error('Failed to mark messages as read')
      }
    } else {
      console.warn('Cannot mark messages as read - no current user')
    }

    // Setup subscriptions
    setupMessageSubscriptionForConversation(conversation.id)
    // No need to setup typing subscription again - it's already set up for all conversations
  }

  // Load messages for selected conversation
  const loadConversationMessages = async (conversationId: string) => {
    loadingMessages.value = true
    try {
      const loadedMessages = await loadMessages(conversationId)
      messages.value = loadedMessages
      scrollToBottom()
      console.log('Loaded messages:', loadedMessages.length)
    } catch (error) {
      console.error('Error loading messages:', error)
      toast.error('Failed to load messages')
      messages.value = []
    } finally {
      loadingMessages.value = false
    }
  }

  // Send message to student
  const sendMessageToStudent = async (messageText?: string) => {
    const textToSend = messageText || newMessage.value.trim()

    if (!textToSend || !selectedConversation.value || sendingMessage.value) return

    if (!currentUser.value) {
      toast.error('Authentication required')
      return
    }

    // Clear input
    if (!messageText) {
      newMessage.value = ''
    }

    sendingMessage.value = true

    try {
      const sentMessage = await sendMessage(
        selectedConversation.value.id,
        textToSend,
        currentUser.value.id
      )

      // Only add if it's for current conversation
      if (selectedConversation.value.id === currentConversationId) {
        messages.value.push(sentMessage)
        scrollToBottom()
      }

      console.log('Message sent successfully')
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
      // Restore message on error
      if (!messageText) {
        newMessage.value = textToSend
      }
    } finally {
      sendingMessage.value = false
    }
  }

  // Setup message subscription for a conversation
  const setupMessageSubscriptionForConversation = (conversationId: string) => {
    console.log('Setting up broadcast subscription for support conversation:', conversationId)

    messageSubscription = setupMessageSubscription(
      conversationId,
      (newMessage: Message) => {
        // Only add if it's for current conversation
        if (conversationId === currentConversationId) {
          // Prevent duplicates
          const exists = messages.value.some(msg => msg.id === newMessage.id)
          if (!exists) {
            messages.value.push(newMessage)
            scrollToBottom()
            console.log('Added real-time message via broadcast')
          }
        }
        
        // Update unread count for this conversation if message is from another user
        if (newMessage.user_id !== currentUser.value?.id) {
          // Increment unread count
          unreadCounts.value[conversationId] = (unreadCounts.value[conversationId] || 0) + 1
        }
      },
      currentUser.value.id
    )
  }

  // Setup subscription for new conversations
  const setupConversationsSubscription = () => {
    console.log('Setting up broadcast subscription for conversations')

    conversationsSubscription = setupAdminSupportConversationsSubscription(
      (newConversation: Conversation) => {
        // Add new conversation to the list
        const exists = supportConversations.value.some(
          conv => conv.id === newConversation.id
        )
        if (!exists) {
          supportConversations.value.unshift(newConversation)
          toast.info('New support conversation started')
          console.log('New support conversation added via broadcast')
          // Increment total count
          totalCount.value++
        }
      }
    )
  }

  // Pagination functions
  const goToPage = async (page: number) => {
    if (page >= 1 && page <= totalPages.value) {
      await loadSupportConversations(page)
    }
  }

  const nextPage = async () => {
    if (currentPage.value < totalPages.value) {
      await goToPage(currentPage.value + 1)
    }
  }

  const previousPage = async () => {
    if (currentPage.value > 1) {
      await goToPage(currentPage.value - 1)
    }
  }

  const changePageSize = async (newPageSize: number) => {
    pageSize.value = newPageSize
    currentPage.value = 1 // Reset to first page
    await loadSupportConversations(1)
  }

  // Open inbox dialog
  const openInbox = async () => {
    showInbox.value = true
    await loadSupportConversations()
    setupConversationsSubscription()
  }

  // Close inbox dialog
  const closeInbox = () => {
    showInbox.value = false
    selectedConversation.value = null
    messages.value = []
    newMessage.value = ''

    // Cleanup subscriptions
    if (messageSubscription) {
      messageSubscription.unsubscribe()
      messageSubscription = null
    }
    if (conversationsSubscription) {
      conversationsSubscription.unsubscribe()
      conversationsSubscription = null
    }
    
    // Cleanup all typing subscriptions
    typingSubscriptions.forEach((subscription) => {
      subscription.unsubscribe()
    })
    typingSubscriptions.clear()
    
    // Clear all typing timeouts
    Object.values(conversationTypingTimeouts.value).forEach(timeout => {
      clearTimeout(timeout)
    })
    conversationTypingTimeouts.value = {}
    
    if (typingTimeout.value) {
      clearTimeout(typingTimeout.value)
      typingTimeout.value = null
    }

    // Reset typing state
    isOtherUserTyping.value = false
    otherUserTypingName.value = ''
    conversationTypingStatus.value = {}

    currentConversationId = null
    console.log('Inbox closed, subscriptions cleaned up')
  }

  // Cleanup on unmount
  onUnmounted(() => {
    if (messageSubscription) {
      messageSubscription.unsubscribe()
    }
    if (conversationsSubscription) {
      conversationsSubscription.unsubscribe()
    }
    
    // Cleanup all typing subscriptions
    typingSubscriptions.forEach((subscription) => {
      subscription.unsubscribe()
    })
    typingSubscriptions.clear()
    
    // Clear all typing timeouts
    Object.values(conversationTypingTimeouts.value).forEach(timeout => {
      clearTimeout(timeout)
    })
    conversationTypingTimeouts.value = {}
    
    if (typingTimeout.value) {
      clearTimeout(typingTimeout.value)
    }
  })

  return {
    showInbox,
    supportConversations,
    selectedConversation,
    messages,
    newMessage,
    loadingConversations,
    loadingMessages,
    sendingMessage,
    unreadCounts,
    isOtherUserTyping,
    otherUserTypingName,
    conversationTypingStatus, // For showing typing in conversation list
    // Pagination state
    currentPage,
    pageSize,
    totalCount,
    totalPages,
    // Functions
    openInbox,
    closeInbox,
    selectConversation,
    sendMessageToStudent,
    loadSupportConversations,
    handleTyping,
    // Pagination functions
    goToPage,
    nextPage,
    previousPage,
    changePageSize,
  }
}
