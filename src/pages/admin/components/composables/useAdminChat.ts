// useAdminChat.ts
import { ref, onUnmounted, nextTick } from 'vue'
import { useToast } from 'vue-toastification'
import { loadConversationsForItem } from '@/stores/conversation'
import { 
  loadMessages, 
  sendMessage, 
  setupMessageSubscription 
} from '@/stores/messages'
import type { Message, Conversation } from '@/types/chat'

interface Item {
  id: number
  title: string
}

export function useAdminChat(currentUser: any) {
  const toast = useToast()

  // State
  const showAdminConversationsDialog = ref(false)
  const selectedItemForConversations = ref<Item | null>(null)
  const adminConversations = ref<Conversation[]>([])
  const selectedAdminConversation = ref<Conversation | null>(null)
  const adminMessages = ref<Message[]>([])
  const newAdminMessage = ref('')
  const loadingAdminConversations = ref(false)
  const loadingAdminMessages = ref(false)
  const sendingAdminMessage = ref(false)
  
  let adminMessageSubscription: any = null
  let currentConversationId: string | null = null

  // Helper to scroll messages to the bottom
  const scrollAdminMessagesToBottom = () => {
    nextTick(() => {
      const messagesContainer = document.querySelector('.admin-messages-container')
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight
      }
    })
  }

  // Opens the admin conversations dialog and loads conversations for a specific item
  const handleOpenConversations = async (item: Item) => {
    console.log('Opening conversations for item:', item.id, item.title)
    
    // Clean up previous state
    cleanupConversationState()
    
    selectedItemForConversations.value = item
    showAdminConversationsDialog.value = true
    await loadAdminConversationsForItem(item.id)
  }

  // Loads conversations for a specific item using store function
  const loadAdminConversationsForItem = async (itemId: number) => {
    loadingAdminConversations.value = true
    try {
      console.log('Loading conversations for item ID:', itemId)
      
      const conversations = await loadConversationsForItem(itemId)
      
      console.log('Found conversations:', conversations.length)
      adminConversations.value = conversations
      
    } catch (error) {
      console.error('Error loading admin conversations:', error)
      toast.error('Failed to load conversations')
      adminConversations.value = []
    } finally {
      loadingAdminConversations.value = false
    }
  }

  // Selects a conversation and loads its messages
  const selectAdminConversation = async (conversation: Conversation) => {
    console.log('Selecting conversation:', conversation.id)
    
    // Clean up previous subscription
    cleanupSubscription()
    
    // Clear previous messages and set new conversation
    adminMessages.value = []
    selectedAdminConversation.value = conversation
    currentConversationId = conversation.id
    
    // Load messages for the new conversation
    await loadAdminMessagesForConversation(conversation.id)
    
    // Setup subscription for the new conversation
    setupAdminMessageSubscription(conversation.id)
  }

  // Loads messages for a specific conversation using store function
  const loadAdminMessagesForConversation = async (conversationId: string) => {
    console.log('Loading messages for conversation:', conversationId)
    loadingAdminMessages.value = true
    
    try {
      const messages = await loadMessages(conversationId)
      
      console.log('Loaded messages:', messages.length)
      adminMessages.value = messages
      scrollAdminMessagesToBottom()
    } catch (error) {
      console.error('Error loading admin messages:', error)
      toast.error('Failed to load messages')
      adminMessages.value = []
    } finally {
      loadingAdminMessages.value = false
    }
  }

  // Sends a new message from the admin using store function
  const sendAdminMessage = async (payload?: {
    conversationId: string
    message: string
    userId: string
  }) => {
    // Determine message data source
    let conversationId: string
    let messageText: string
    let userId: string
    
    if (payload) {
      // Message sent from dialog component
      conversationId = payload.conversationId
      messageText = payload.message
      userId = payload.userId
    } else {
      // Message sent from composable (fallback)
      if (!newAdminMessage.value.trim() || !selectedAdminConversation.value) return
      conversationId = selectedAdminConversation.value.id
      messageText = newAdminMessage.value.trim()
      userId = currentUser.value.id
      newAdminMessage.value = ''
    }

    if (sendingAdminMessage.value) return
    sendingAdminMessage.value = true

    try {
      console.log('Sending message to conversation:', conversationId)
      
      const sentMessage = await sendMessage(conversationId, messageText, userId)
      
      // Only add the message if it belongs to the current conversation
      if (conversationId === currentConversationId) {
        adminMessages.value.push(sentMessage)
        scrollAdminMessagesToBottom()
        console.log('Message added to current conversation')
      } else {
        console.log('Message sent to different conversation, not adding to current view')
      }
      
    } catch (error) {
      console.error('Error sending admin message:', error)
      toast.error('Failed to send message')
    } finally {
      sendingAdminMessage.value = false
    }
  }

  // Subscribes to new messages in real-time for admin chat using store function
  const setupAdminMessageSubscription = (conversationId: string) => {
    console.log('Setting up subscription for conversation:', conversationId)
    
    adminMessageSubscription = setupMessageSubscription(
      conversationId,
      (newMessage: Message) => {
        console.log('Received real-time message for conversation:', conversationId)
        
        // Only add the message if it's for the currently selected conversation
        if (conversationId === currentConversationId) {
          // Check if the message is not already in the array (prevent duplicates)
          const messageExists = adminMessages.value.some(msg => msg.id === newMessage.id)
          if (!messageExists) {
            adminMessages.value.push(newMessage)
            scrollAdminMessagesToBottom()
            console.log('Added real-time message to current conversation')
          }
        }
      },
      currentUser.value.id
    )
  }

  // Helper to clean up subscription
  const cleanupSubscription = () => {
    if (adminMessageSubscription) {
      console.log('Unsubscribing from previous conversation:', currentConversationId)
      adminMessageSubscription.unsubscribe()
      adminMessageSubscription = null
    }
  }

  // Helper to clean up conversation state
  const cleanupConversationState = () => {
    selectedAdminConversation.value = null
    adminMessages.value = []
    cleanupSubscription()
    currentConversationId = null
  }

  // Closes the admin conversations dialog and cleans up
  const closeAdminConversationsDialog = () => {
    console.log('Closing admin conversations dialog')
    
    showAdminConversationsDialog.value = false
    selectedItemForConversations.value = null
    adminConversations.value = []
    newAdminMessage.value = ''
    
    cleanupConversationState()
  }

  onUnmounted(() => {
    console.log('useAdminChat unmounting, cleaning up subscriptions')
    cleanupSubscription()
  })

  return {
    showAdminConversationsDialog,
    selectedItemForConversations,
    adminConversations,
    selectedAdminConversation,
    adminMessages,
    newAdminMessage,
    loadingAdminConversations,
    loadingAdminMessages,
    sendingAdminMessage,
    handleOpenConversations,
    selectAdminConversation,
    sendAdminMessage,
    closeAdminConversationsDialog,
  }
}