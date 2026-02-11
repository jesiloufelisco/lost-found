import { ref, onUnmounted, nextTick } from 'vue'
import { useToast } from 'vue-toastification'
import type { Conversation, Message } from '@/types/chat'
import { 
  sendMessage as sendMessageAPI, 
  loadMessages as loadMessagesAPI,
  setupMessageSubscription as setupSubscription 
} from '@/stores/messages'
import {
  getOrCreateAdminSupportConversation,
  getAdminUserId
} from '@/stores/adminSupport'

export function useAdminSupport(currentUser: any) {
  const toast = useToast()

  const showSupportChat = ref(false)
  const supportConversation = ref<Conversation | null>(null)
  const supportMessages = ref<Message[]>([])
  const newSupportMessage = ref('')
  const messagesLoading = ref(false)
  const sendingMessage = ref(false)
  const initializingChat = ref(false)
  let messageSubscription: any = null

  // Helper to scroll messages to the bottom
  const scrollToBottom = () => {
    nextTick(() => {
      const messagesContainer = document.querySelector('.support-messages-container')
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight
      }
    })
  }

  // Initialize admin support chat
  const initializeSupportChat = async () => {
    if (!currentUser.value) {
      toast.error('Please log in to contact admin')
      return false
    }

    initializingChat.value = true
    try {
      // Get admin user ID
      const adminId = await getAdminUserId()
      
      // Get or create conversation
      const conversation = await getOrCreateAdminSupportConversation(
        currentUser.value.id,
        adminId
      )
      
      supportConversation.value = conversation
      
      // Load existing messages
      await loadSupportMessages()
      
      // Setup real-time subscription
      setupSupportMessageSubscription()
      
      return true
    } catch (error) {
      console.error('Error initializing support chat:', error)
      toast.error('Failed to connect to admin support')
      return false
    } finally {
      initializingChat.value = false
    }
  }

  // Open support chat dialog
  const openSupportChat = async () => {
    showSupportChat.value = true
    
    if (!supportConversation.value) {
      await initializeSupportChat()
    }
  }

  // Load messages for support conversation
  const loadSupportMessages = async () => {
    if (!supportConversation.value) return
    
    messagesLoading.value = true
    try {
      supportMessages.value = await loadMessagesAPI(supportConversation.value.id)
      scrollToBottom()
    } catch (error) {
      console.error('Error loading support messages:', error)
      toast.error('Failed to load messages')
    } finally {
      messagesLoading.value = false
    }
  }

  // Send message to admin
  const sendSupportMessage = async (messageText?: string) => {
    const textToSend = messageText || newSupportMessage.value.trim()
    
    if (!textToSend || sendingMessage.value) return
    
    if (!currentUser.value) {
      toast.error('Please log in to send messages')
      return
    }

    // Clear input immediately
    if (!messageText) {
      newSupportMessage.value = ''
    }
    
    sendingMessage.value = true

    try {
      let conversation = supportConversation.value

      // Initialize conversation if it doesn't exist
      if (!conversation) {
        const initialized = await initializeSupportChat()
        if (!initialized) {
          throw new Error('Failed to initialize chat')
        }
        conversation = supportConversation.value
      }

      if (!conversation) {
        throw new Error('No conversation available')
      }

      // Send the message
      const sentMessage = await sendMessageAPI(
        conversation.id,
        textToSend,
        currentUser.value.id
      )
      
      supportMessages.value.push(sentMessage)
      scrollToBottom()
    } catch (error) {
      console.error('Error sending support message:', error)
      toast.error('Failed to send message')
      // Restore message on error
      if (!messageText) {
        newSupportMessage.value = textToSend
      }
    } finally {
      sendingMessage.value = false
    }
  }

  // Setup real-time subscription for new messages
  const setupSupportMessageSubscription = () => {
    if (messageSubscription) messageSubscription.unsubscribe()
    if (!supportConversation.value) return

    const onNewMessage = (message: Message) => {
      // Check if message already exists (prevent duplicates)
      const exists = supportMessages.value.some(msg => msg.id === message.id)
      if (!exists) {
        supportMessages.value.push(message)
        scrollToBottom()
      }
    }

    messageSubscription = setupSubscription(
      supportConversation.value.id,
      onNewMessage,
      currentUser.value.id
    )
  }

  // Close support chat
  const closeSupportChat = () => {
    showSupportChat.value = false
    // Keep conversation and messages for when user reopens
  }

  // Cleanup on unmount
  onUnmounted(() => {
    if (messageSubscription) {
      messageSubscription.unsubscribe()
    }
  })

  return {
    showSupportChat,
    supportConversation,
    supportMessages,
    newSupportMessage,
    messagesLoading,
    sendingMessage,
    initializingChat,
    openSupportChat,
    sendSupportMessage,
    closeSupportChat,
  }
}