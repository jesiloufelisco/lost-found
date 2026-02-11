// useUserChat.ts
import { ref, onUnmounted, nextTick } from 'vue'
import { useToast } from 'vue-toastification'
import type { Item, Conversation, Message } from '@/types/chat'
import { 
  sendMessage as sendMessageAPI, 
  loadMessages as loadMessagesAPI,
  setupMessageSubscription as setupSubscription 
} from '@/stores/messages'
import {
  loadExistingConversation as loadExistingConversationAPI,
  createConversation as createConversationAPI
} from '@/stores/conversation'

export function useUserChat(currentUser: any) {
  const toast = useToast()

  const showChatDialog = ref(false)
  const selectedItem = ref<Item | null>(null)
  const currentConversation = ref<Conversation | null>(null)
  const messages = ref<Message[]>([])
  const newMessage = ref('')
  const messagesLoading = ref(false)
  const sendingMessage = ref(false)
  let messageSubscription: any = null

  // Helper to scroll messages to the bottom
  const scrollToBottom = () => {
    nextTick(() => {
      const messagesContainer = document.querySelector('.messages-container')
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight
      }
    })
  }

  // Load existing conversation if it exists
  const loadExistingConversation = async (item: Item) => {
    messagesLoading.value = true

    try {
      // Check for existing conversation using the API
      const existingConv = await loadExistingConversationAPI(
        item.id,
        currentUser.value.id,
        item.user_id
      )

      if (existingConv) {
        currentConversation.value = existingConv
        await loadMessages()
        setupMessageSubscription()
      }
    } catch (error) {
      console.error('Error loading existing conversation:', error)
    } finally {
      messagesLoading.value = false
    }
  }

  // Creates a new conversation
  const createConversation = async (item: Item) => {
    try {
      const newConv = await createConversationAPI(
        item.id,
        currentUser.value.id,
        item.user_id
      )
      
      currentConversation.value = newConv
      setupMessageSubscription()
      toast.success('Conversation started!')
      
      return newConv
    } catch (error) {
      console.error('Error creating conversation:', error)
      toast.error('Failed to create conversation')
      throw error
    }
  }

  // Opens chat dialog and loads existing conversation if available
  const handleContact = async (item: Item) => {
    if (!currentUser.value) {
      toast.error('Please log in to contact the admin')
      return
    }

    selectedItem.value = item
    showChatDialog.value = true

    // Load existing conversation if it exists, but don't create a new one
    await loadExistingConversation(item)
  }

  // Loads messages for the current conversation
  const loadMessages = async () => {
    if (!currentConversation.value) return
    
    try {
      messages.value = await loadMessagesAPI(currentConversation.value.id)
      scrollToBottom()
    } catch (error) {
      console.error('Error loading messages:', error)
      toast.error('Failed to load messages')
    }
  }

  // Sends a new message
  const sendMessage = async () => {
    if (!newMessage.value.trim() || sendingMessage.value) return
    
    if (!currentUser.value) {
      toast.error('Please log in to send messages')
      return
    }

    if (!selectedItem.value) {
      toast.error('No item selected')
      return
    }

    const messageText = newMessage.value.trim()
    newMessage.value = ''
    sendingMessage.value = true

    try {
      let conversation = currentConversation.value

      // Create conversation if it doesn't exist
      if (!conversation) {
        conversation = await createConversation(selectedItem.value)
        currentConversation.value = conversation
      }

      // Ensure we have a conversation before proceeding
      if (!conversation) {
        throw new Error('Failed to create or get conversation')
      }

      // Send the message using the API
      const data = await sendMessageAPI(
        conversation.id,
        messageText,
        currentUser.value.id
      )
      
      messages.value.push(data)
      scrollToBottom()
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
      newMessage.value = messageText
    } finally {
      sendingMessage.value = false
    }
  }

  // Subscribes to new messages in real-time
  const setupMessageSubscription = () => {
    if (messageSubscription) messageSubscription.unsubscribe()
    if (!currentConversation.value) return

    const onNewMessage = (message: Message) => {
      messages.value.push(message)
      scrollToBottom()
    }

    messageSubscription = setupSubscription(
      currentConversation.value.id,
      onNewMessage,
      currentUser.value.id
    )
  }

  // Closes the chat dialog and cleans up
  const closeChatDialog = () => {
    showChatDialog.value = false
    selectedItem.value = null
    currentConversation.value = null
    messages.value = []
    newMessage.value = ''
    if (messageSubscription) {
      messageSubscription.unsubscribe()
      messageSubscription = null
    }
  }

  onUnmounted(() => {
    if (messageSubscription) {
      messageSubscription.unsubscribe()
    }
  })

  return {
    showChatDialog,
    selectedItem,
    messages,
    newMessage,
    messagesLoading,
    sendingMessage,
    handleContact,
    sendMessage,
    closeChatDialog,
  }
}