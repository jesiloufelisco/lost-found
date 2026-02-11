//DirectAdminMessageCard.vue
<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { useToast } from 'vue-toastification'
import { formatDate } from '@/utils/helpers'
import type { Conversation, Message } from '@/types/chat'
import { useAuthUserStore } from '@/stores/authUser'
import {
  sendMessage as sendMessageAPI,
  loadMessages as loadMessagesAPI,
  setupMessageSubscription as setupSubscription
} from '@/stores/messages'
import {
  getOrCreateAdminSupportConversation,
} from '@/stores/adminSupport'

const props = defineProps({
  currentUser: {
    type: Object,
    required: true
  },
  isCurrentUserAdmin: {
    type: Boolean,
    required: true
  }
})

const toast = useToast()

// Admin selection state
const showAdminSelectionDialog = ref(false)
const adminUsers = ref<any[]>([])
const loadingAdmins = ref(false)
const selectedAdmin = ref<any>(null)

// Chat state
const showChatDialog = ref(false)
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

// Check if message is from current user
const isMyMessage = (message: Message) => {
  return message.user_id === props.currentUser?.id
}

// Load admin users
const loadAdminUsers = async () => {
  loadingAdmins.value = true
  try {
    const authStore = useAuthUserStore()
    const { users, error } = await authStore.getAllUsers()

    if (error) throw error

    // Filter users with role 1 (admin role)
    adminUsers.value = (users || [])
      .filter(user => {
        const role = user.raw_app_meta_data?.role || user.raw_user_meta_data?.role
        return role === 1
      })
      .map(user => ({
        id: user.id,
        full_name: user.raw_user_meta_data?.full_name || user.email?.split('@')[0] || 'Admin User',
        email: user.email
      }))

    console.log('Loaded admin users:', adminUsers.value)
  } catch (error) {
    console.error('Error loading admin users:', error)
    toast.error('Failed to load admin users')
  } finally {
    loadingAdmins.value = false
  }
}

// Initialize admin support chat for specific admin
const initializeSupportChat = async () => {
  if (!props.currentUser || !selectedAdmin.value) {
    toast.error('Please log in and select an admin to contact')
    return false
  }

  initializingChat.value = true
  try {
    // Get or create conversation for direct messaging with selected admin
    const conversation = await getOrCreateAdminSupportConversation(
      props.currentUser.id,
      selectedAdmin.value.id
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

// Setup real-time message subscription
const setupSupportMessageSubscription = () => {
  if (!supportConversation.value || !props.currentUser) return

  // Cleanup existing subscription
  if (messageSubscription) {
    messageSubscription.unsubscribe()
  }

  messageSubscription = setupSubscription(
    supportConversation.value.id,
    (newMessage: Message) => {
      supportMessages.value.push(newMessage)
      scrollToBottom()
    },
    props.currentUser.id
  )
}

// Handle contact button click - opens admin selection dialog
const handleContactAdmin = async () => {
  if (!props.currentUser) {
    toast.error('Please log in to contact admin')
    return
  }

  showAdminSelectionDialog.value = true
  await loadAdminUsers()
}

// Handle admin selection and open chat
const selectAdminAndOpenChat = async (admin: any) => {
  selectedAdmin.value = admin
  showAdminSelectionDialog.value = false
  showChatDialog.value = true

  // Initialize conversation with selected admin
  await initializeSupportChat()
}

// Close admin selection dialog
const closeAdminSelection = () => {
  showAdminSelectionDialog.value = false
  selectedAdmin.value = null
}

// Open support chat dialog
const openSupportChat = async () => {
  showChatDialog.value = true

  if (!supportConversation.value) {
    await initializeSupportChat()
  }
}// Send message to admin
const sendSupportMessage = async (messageText?: string) => {
  const textToSend = messageText || newSupportMessage.value.trim()

  if (!textToSend || sendingMessage.value) return

  if (!props.currentUser) {
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
      const success = await initializeSupportChat()
      if (!success) return
      conversation = supportConversation.value
    }

    if (!conversation) {
      toast.error('Failed to establish connection with admin')
      return
    }

    // Send the message
    const sentMessage = await sendMessageAPI(
      conversation.id,
      textToSend,
      props.currentUser.id
    )

    // Add to local messages
    supportMessages.value.push(sentMessage)
    scrollToBottom()

    toast.success('Message sent to admin!')
  } catch (error) {
    console.error('Error sending support message:', error)
    toast.error('Failed to send message to admin')
  } finally {
    sendingMessage.value = false
  }
}

// Close support chat
const closeSupportChat = () => {
  showChatDialog.value = false
  supportConversation.value = null
  supportMessages.value = []
  newSupportMessage.value = ''
  selectedAdmin.value = null

  // Cleanup subscription
  if (messageSubscription) {
    messageSubscription.unsubscribe()
    messageSubscription = null
  }
}

// Handle keyboard shortcuts
const handleKeyPress = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendSupportMessage()
  }
}

// Cleanup on unmount
onUnmounted(() => {
  if (messageSubscription) {
    messageSubscription.unsubscribe()
  }
})

// Watch for dialog close to cleanup
watch(showChatDialog, (newVal) => {
  if (!newVal && messageSubscription) {
    messageSubscription.unsubscribe()
    messageSubscription = null
  }
})
</script>

<template>
  <!-- Direct Admin Message Card -->
  <v-card
    v-if="!isCurrentUserAdmin && currentUser"
    elevation="3"
    class="direct-admin-card mb-4"
    @click="handleContactAdmin"
  >
    <v-card-text class="pa-4">
      <div class="d-flex align-center">
        <v-avatar color="primary" class="me-3" size="40">
          <v-icon color="white" size="24">mdi-headset</v-icon>
        </v-avatar>
        <div class="flex-grow-1">
          <h3 class="text-h6 font-weight-bold text-primary mb-1">
            Contact Admin Support
          </h3>
          <p class="text-body-2 text-grey-darken-1 mb-0">
            Need help? Send a direct message to our admin team
          </p>
        </div>
        <v-icon color="primary" size="24">mdi-chevron-right</v-icon>
      </div>
    </v-card-text>

    <v-card-actions class="pa-4 pt-0">
      <v-btn
        color="primary"
        variant="outlined"
        block
        prepend-icon="mdi-message-text"
        @click.stop="handleContactAdmin"
      >
        Start Conversation
      </v-btn>
    </v-card-actions>
  </v-card>

  <!-- Admin Selection Dialog -->
  <v-dialog v-model="showAdminSelectionDialog" max-width="500px" persistent>
    <v-card>
      <v-card-title class="d-flex align-center pa-4 bg-primary">
        <v-icon class="me-2 text-white">mdi-account-multiple</v-icon>
        <div class="text-white">
          <div class="text-h6">Select Admin to Contact</div>
          <div class="text-caption opacity-80">
            Choose an admin for direct messaging
          </div>
        </div>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          color="white"
          @click="closeAdminSelection"
        />
      </v-card-title>

      <v-card-text class="pa-4">
        <!-- Loading state -->
        <div v-if="loadingAdmins" class="text-center py-8">
          <v-progress-circular indeterminate color="primary" />
          <p class="text-body-2 mt-3">Loading available admins...</p>
        </div>

        <!-- Empty state -->
        <div v-else-if="adminUsers.length === 0" class="text-center py-8">
          <v-icon size="60" color="grey-lighten-1">mdi-account-alert</v-icon>
          <p class="text-h6 text-grey-darken-1 mt-3">No Admins Available</p>
          <p class="text-body-2 text-grey">
            There are currently no admin users available to chat with.
          </p>
        </div>

        <!-- Admin list -->
        <v-list v-else class="pa-0">
          <v-list-item
            v-for="admin in adminUsers"
            :key="admin.id"
            @click="selectAdminAndOpenChat(admin)"
            class="admin-list-item rounded mb-2"
            lines="two"
          >
            <template v-slot:prepend>
              <v-avatar color="primary" size="48">
                <span class="text-white font-weight-bold">
                  {{ admin.full_name ? admin.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) : 'A' }}
                </span>
              </v-avatar>
            </template>

            <v-list-item-title class="font-weight-bold">
              {{ admin.full_name || 'Admin User' }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ admin.email }}
            </v-list-item-subtitle>

            <template v-slot:append>
              <v-icon color="primary">mdi-chevron-right</v-icon>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </v-dialog>  <!-- Chat Dialog -->
  <v-dialog
    v-model="showChatDialog"
    max-width="500"
    persistent
    :fullscreen="$vuetify.display.mobile"
  >
    <v-card>
      <v-card-title class="d-flex align-center pa-4 bg-primary">
        <v-avatar color="white" size="40" class="me-3">
          <span class="text-primary font-weight-bold">
            {{ selectedAdmin ? (selectedAdmin.full_name ? selectedAdmin.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) : 'A') : 'A' }}
          </span>
        </v-avatar>
        <div class="text-white flex-grow-1">
          <div class="text-h6 font-weight-bold">{{ selectedAdmin?.full_name || 'Admin Support' }}</div>
          <div class="text-caption opacity-80">
            {{ initializingChat ? 'Connecting...' : 'Direct messaging' }}
          </div>
        </div>
        <v-btn
          icon
          variant="text"
          color="white"
          @click="closeSupportChat"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text class="pa-0" style="height: 400px;">
        <div class="support-messages-container h-100 pa-4">
          <!-- Loading State -->
          <div
            v-if="messagesLoading || initializingChat"
            class="d-flex justify-center align-center h-100"
          >
            <div class="text-center">
              <v-progress-circular
                indeterminate
                color="primary"
                size="40"
              />
              <p class="text-caption mt-2">
                {{ initializingChat ? 'Connecting to admin...' : 'Loading messages...' }}
              </p>
            </div>
          </div>

          <!-- Empty State -->
          <div
            v-else-if="supportMessages.length === 0"
            class="empty-state text-center h-100 d-flex flex-column justify-center"
          >
            <v-icon size="64" color="grey-lighten-1">mdi-chat-outline</v-icon>
            <p class="text-h6 text-grey-darken-1 mt-3 mb-2">
              Hi! How can we help you?
            </p>
            <p class="text-body-2 text-grey">
              Send a message to start the conversation with our admin team
            </p>
          </div>

          <!-- Messages -->
          <div v-else class="messages-list">
            <div
              v-for="message in supportMessages"
              :key="message.id"
              class="message-bubble mb-3"
              :class="{ 'my-message': isMyMessage(message) }"
            >
              <div class="message-content">
                <div class="message-text">{{ message.message }}</div>
                <div class="message-time">
                  {{ formatDate(message.created_at) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </v-card-text>

      <!-- Input Area -->
      <v-card-actions class="pa-4 bg-grey-lighten-5">
        <div class="w-100">
          <div class="d-flex align-center gap-2">
            <v-text-field
              v-model="newSupportMessage"
              placeholder="Type your message to admin..."
              variant="outlined"
              density="compact"
              hide-details
              @keypress="handleKeyPress"
              :disabled="sendingMessage || initializingChat"
              class="flex-grow-1"
            />
            <v-btn
              color="primary"
              icon
              :loading="sendingMessage"
              :disabled="!newSupportMessage.trim() || initializingChat"
              @click="sendSupportMessage"
            >
              <v-icon>mdi-send</v-icon>
            </v-btn>
          </div>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.direct-admin-card {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.direct-admin-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15) !important;
}

.support-messages-container {
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #ccc transparent;
}

.support-messages-container::-webkit-scrollbar {
  width: 6px;
}

.support-messages-container::-webkit-scrollbar-track {
  background: transparent;
}

.support-messages-container::-webkit-scrollbar-thumb {
  background-color: #ccc;
  border-radius: 3px;
}

.messages-list {
  display: flex;
  flex-direction: column;
}

.message-bubble {
  display: flex;
  margin-bottom: 12px;
}

.message-bubble.my-message {
  justify-content: flex-end;
}

.message-content {
  max-width: 75%;
  padding: 12px 16px;
  border-radius: 18px;
  background-color: #f5f5f5;
  color: #212121;
}

.my-message .message-content {
  background-color: #1976d2;
  color: white;
}

.message-text {
  word-wrap: break-word;
  line-height: 1.4;
  font-size: 0.95rem;
}

.message-time {
  font-size: 0.75rem;
  opacity: 0.7;
  margin-top: 6px;
  text-align: right;
}

.my-message .message-time {
  color: rgba(255, 255, 255, 0.7);
}

.empty-state {
  padding: 32px 16px;
}

.admin-list-item {
  border: 1px solid rgba(0, 0, 0, 0.12);
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.admin-list-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
  border-color: rgb(var(--v-theme-primary));
  transform: translateX(4px);
}

/* Mobile responsive */
@media (max-width: 600px) {
  .direct-admin-card {
    margin-bottom: 16px;
  }

  .message-content {
    max-width: 85%;
    padding: 10px 14px;
  }
}
</style>
