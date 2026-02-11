<script setup lang="ts">
import { ref, computed } from 'vue'
import { formatDate } from '@/utils/helpers'
import { supabase } from '@/lib/supabase'

interface Message {
  id: string
  conversation_id: string
  message: string
  user_id: string
  created_at: string
}

interface Conversation {
  id: string
  sender_id: string
  receiver_id: string
  created_at: string
  sender_profile?: {
    full_name?: string
    email: string
  }
  item?: {
    id: number
    title: string
    description?: string
    status: 'lost' | 'found'
  } | null
  latest_message?: {
    message: string
    created_at: string
  }
  message_count?: number
}

const props = defineProps({
  show: { type: Boolean, required: true },
  conversations: { type: Array as () => Conversation[], required: true },
  selectedConversation: { type: Object as () => Conversation | null, default: null },
  messages: { type: Array as () => Message[], required: true },
  loadingConversations: { type: Boolean, required: true },
  loadingMessages: { type: Boolean, required: true },
  sendingMessage: { type: Boolean, required: true },
  unreadCounts: { type: Object as () => Record<string, number>, default: () => ({}) },
})

const emit = defineEmits(['update:show', 'select-conversation', 'send-message'])

const newMessage = ref('')
const currentUser = ref<any>(null)

// Get current user
const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  currentUser.value = user
}
getCurrentUser()

const isMyMessage = (message: Message) => {
  return message.user_id === currentUser.value?.id
}

const handleKeyPress = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

const sendMessage = () => {
  if (newMessage.value.trim()) {
    emit('send-message', newMessage.value.trim())
    newMessage.value = ''
  }
}

const closeDialog = () => {
  emit('update:show', false)
}

const getStudentName = (conversation: Conversation) => {
  return conversation.sender_profile?.full_name ||
         conversation.sender_profile?.email ||
         'Unknown Student'
}

const getLatestMessagePreview = (conversation: Conversation) => {
  if (!conversation.latest_message) return 'No messages yet'
  const msg = conversation.latest_message.message
  return msg.length > 50 ? msg.substring(0, 50) + '...' : msg
}
</script>

<template>
  <v-dialog :model-value="show" max-width="900px" persistent scrollable>
    <v-card class="admin-support-inbox">
      <v-card-title class="d-flex align-center pa-4 bg-primary">
        <v-icon class="me-2 text-white" size="28">mdi-inbox</v-icon>
        <div class="text-white">
          <div class="text-h5 font-weight-bold">Admin Support Inbox</div>
          <div class="text-caption opacity-80">
            Student support conversations
          </div>
        </div>
        <v-spacer />
        <v-chip
          v-if="conversations.length > 0"
          color="white"
          variant="flat"
          size="small"
          class="me-2"
        >
          {{ conversations.length }} conversation{{ conversations.length !== 1 ? 's' : '' }}
        </v-chip>
        <v-btn
          icon="mdi-close"
          variant="text"
          color="white"
          @click="closeDialog"
        />
      </v-card-title>

      <div class="d-flex" style="height: 600px">
        <!-- Conversations List -->
        <div class="conversations-sidebar">
          <!-- Loading State -->
          <div
            v-if="loadingConversations"
            class="d-flex justify-center align-center pa-8"
          >
            <v-progress-circular indeterminate color="primary" size="32" />
          </div>

          <!-- Empty State -->
          <div v-else-if="conversations.length === 0" class="text-center pa-8">
            <v-icon size="56" color="grey-lighten-1">mdi-inbox-outline</v-icon>
            <div class="text-body-2 text-grey-darken-1 mt-3 mb-1">
              No support conversations yet
            </div>
            <div class="text-caption text-grey">
              Students will appear here when they contact admin
            </div>
          </div>

          <!-- Conversations List -->
          <v-list v-else class="pa-0">
            <v-list-item
              v-for="conversation in conversations"
              :key="conversation.id"
              @click="emit('select-conversation', conversation)"
              :active="selectedConversation?.id === conversation.id"
              class="conversation-item py-3"
              lines="three"
            >
              <template #prepend>
                <v-badge
                  v-if="unreadCounts[conversation.id] > 0"
                  :content="unreadCounts[conversation.id]"
                  color="error"
                  overlap
                >
                  <v-avatar
                    :color="conversation.item ? (conversation.item.status === 'lost' ? 'error' : 'success') : 'primary'"
                    size="45"
                    class="me-3"
                  >
                    <v-icon color="white">
                      {{ conversation.item ? (conversation.item.status === 'lost' ? 'mdi-help-circle' : 'mdi-check-circle') : 'mdi-account' }}
                    </v-icon>
                  </v-avatar>
                </v-badge>
                <v-avatar
                  v-else
                  :color="conversation.item ? (conversation.item.status === 'lost' ? 'error' : 'success') : 'primary'"
                  size="45"
                  class="me-3"
                >
                  <v-icon color="white">
                    {{ conversation.item ? (conversation.item.status === 'lost' ? 'mdi-help-circle' : 'mdi-check-circle') : 'mdi-account' }}
                  </v-icon>
                </v-avatar>
              </template>

              <!-- Main Content -->
              <div class="d-flex flex-column">
                <!-- User Name with unread indicator -->
                <div class="d-flex align-center justify-space-between mb-1">
                  <v-list-item-title class="text-subtitle-2 font-weight-bold">
                    {{ getStudentName(conversation) }}
                  </v-list-item-title>
                  <div class="d-flex align-center">
                    <v-icon
                      v-if="unreadCounts[conversation.id] > 0"
                      color="error"
                      size="20"
                      class="ml-2"
                    >
                      mdi-email-alert
                    </v-icon>
                  </div>
                </div>

                <!-- Item Information - Made More Prominent -->
                <div v-if="conversation.item" class="mb-2">
                  <v-chip
                    :color="conversation.item.status === 'lost' ? 'error' : 'success'"
                    variant="elevated"
                    size="small"
                    class="me-2 font-weight-bold"
                  >
                    <v-icon start>
                      {{ conversation.item.status === 'lost' ? 'mdi-help-circle' : 'mdi-check-circle' }}
                    </v-icon>
                    {{ conversation.item.status.toUpperCase() }} ITEM
                  </v-chip>
                  <div class="text-subtitle-2 font-weight-medium text-primary mt-1">
                    📦 {{ conversation.item.title }}
                  </div>
                  <div v-if="conversation.item.description" class="text-caption text-grey-darken-1 mt-1">
                    {{ conversation.item.description.substring(0, 50) }}{{ conversation.item.description.length > 50 ? '...' : '' }}
                  </div>
                </div>

                <div v-else class="mb-2">
                  <v-chip
                    color="info"
                    variant="elevated"
                    size="small"
                    class="font-weight-bold"
                  >
                    <v-icon start>mdi-lifebuoy</v-icon>
                    GENERAL SUPPORT
                  </v-chip>
                </div>

                <!-- Latest Message Preview -->
                <v-list-item-subtitle class="text-caption text-grey-darken-1">
                  {{ getLatestMessagePreview(conversation) }}
                </v-list-item-subtitle>
              </div>

              <template #append>
                <div class="text-caption text-grey">
                  {{ formatDate(conversation.latest_message?.created_at || conversation.created_at) }}
                </div>
              </template>
            </v-list-item>
          </v-list>
        </div>

        <!-- Messages Area -->
        <div class="messages-area flex-grow-1 d-flex flex-column">
          <!-- No Conversation Selected -->
          <div
            v-if="!selectedConversation"
            class="d-flex justify-center align-center flex-grow-1 bg-grey-lighten-4"
          >
            <div class="text-center pa-8">
              <v-icon size="80" color="grey-lighten-1">mdi-message-text-outline</v-icon>
              <div class="text-h6 text-grey-darken-1 mt-4">
                Select a conversation
              </div>
              <div class="text-body-2 text-grey">
                Choose a student from the list to view messages
              </div>
            </div>
          </div>

          <!-- Conversation Selected -->
          <template v-else>
            <!-- Conversation Header -->
            <div class="conversation-header pa-4 bg-grey-lighten-5">
              <!-- User Info Header -->
              <div class="d-flex align-center mb-3">
                <v-avatar
                  :color="selectedConversation.item ? (selectedConversation.item.status === 'lost' ? 'error' : 'success') : 'primary'"
                  size="40"
                  class="me-3"
                >
                  <v-icon color="white">
                    {{ selectedConversation.item ? (selectedConversation.item.status === 'lost' ? 'mdi-help-circle' : 'mdi-check-circle') : 'mdi-account' }}
                  </v-icon>
                </v-avatar>
                <div>
                  <div class="text-subtitle-1 font-weight-bold">
                    {{ getStudentName(selectedConversation) }}
                  </div>
                  <div class="text-caption text-grey-darken-1">
                    {{ selectedConversation.sender_profile?.email }}
                  </div>
                </div>
              </div>

              <!-- Item Information Card -->
              <v-card v-if="selectedConversation.item" variant="tonal" :color="selectedConversation.item.status === 'lost' ? 'error' : 'success'" class="pa-3 mb-2">
                <div class="d-flex align-center mb-2">
                  <v-chip
                    :color="selectedConversation.item.status === 'lost' ? 'error' : 'success'"
                    variant="elevated"
                    size="small"
                    class="font-weight-bold"
                  >
                    <v-icon start>
                      {{ selectedConversation.item.status === 'lost' ? 'mdi-help-circle' : 'mdi-check-circle' }}
                    </v-icon>
                    {{ selectedConversation.item.status.toUpperCase() }} ITEM
                  </v-chip>
                </div>
                <div class="text-subtitle-2 font-weight-bold mb-1">
                  📦 {{ selectedConversation.item.title }}
                </div>
                <div v-if="selectedConversation.item.description" class="text-body-2">
                  {{ selectedConversation.item.description }}
                </div>
              </v-card>

              <!-- General Support Card -->
              <v-card v-else variant="tonal" color="info" class="pa-3 mb-2">
                <div class="d-flex align-center mb-2">
                  <v-chip color="info" variant="elevated" size="small" class="font-weight-bold">
                    <v-icon start>mdi-lifebuoy</v-icon>
                    GENERAL SUPPORT
                  </v-chip>
                </div>
                <div class="text-body-2">
                  General support conversation - No specific item involved
                </div>
              </v-card>
            </div>

            <!-- Messages Container -->
            <div class="admin-support-messages-container flex-grow-1 pa-4">
              <!-- Loading Messages -->
              <div
                v-if="loadingMessages"
                class="d-flex justify-center align-center"
                style="height: 100%"
              >
                <v-progress-circular indeterminate color="primary" />
              </div>

              <!-- No Messages -->
              <div
                v-else-if="messages.length === 0"
                class="text-center pa-8"
              >
                <div class="text-body-2 text-grey-darken-1">
                  No messages in this conversation yet
                </div>
              </div>

              <!-- Messages -->
              <div v-else>
                <div
                  v-for="message in messages"
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

            <!-- Message Input -->
            <div class="message-input-area pa-4 bg-grey-lighten-5">
              <div class="d-flex align-center gap-2">
                <v-text-field
                  v-model="newMessage"
                  placeholder="Type your reply..."
                  variant="outlined"
                  density="comfortable"
                  hide-details
                  @keypress="handleKeyPress"
                  :disabled="sendingMessage"
                  class="flex-grow-1"
                />
                <v-btn
                  color="primary"
                  icon
                  size="large"
                  :loading="sendingMessage"
                  :disabled="!newMessage.trim()"
                  @click="sendMessage"
                >
                  <v-icon>mdi-send</v-icon>
                </v-btn>
              </div>
            </div>
          </template>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.conversations-sidebar {
  width: 320px;
  border-right: 1px solid #e0e0e0;
  overflow-y: auto;
  background-color: #fafafa;
}

.conversation-item {
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  min-height: 100px !important;
  padding: 12px 16px !important;
  transition: all 0.3s ease;
}

.conversation-item:hover {
  background-color: rgb(var(--v-theme-primary) / 0.08);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.conversation-item:active,
.conversation-item.active {
  background-color: rgb(var(--v-theme-primary) / 0.15);
  border-right: 4px solid rgb(var(--v-theme-primary));
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

.messages-area {
  background-color: white;
}

.conversation-header {
  border-bottom: 1px solid #e0e0e0;
  min-height: 72px;
}

.admin-support-messages-container {
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #ccc transparent;
}

.admin-support-messages-container::-webkit-scrollbar {
  width: 6px;
}

.admin-support-messages-container::-webkit-scrollbar-track {
  background: transparent;
}

.admin-support-messages-container::-webkit-scrollbar-thumb {
  background-color: #ccc;
  border-radius: 3px;
}

.message-bubble {
  display: flex;
  margin-bottom: 12px;
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-bubble.my-message {
  justify-content: flex-end;
}

.message-content {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 18px;
  background-color: #f1f3f4;
  color: #212121;
}

.my-message .message-content {
  background-color: #1b5e20;
  color: white;
}

.message-text {
  word-wrap: break-word;
  line-height: 1.5;
}

.message-time {
  font-size: 0.7rem;
  opacity: 0.7;
  margin-top: 4px;
  color: #616161;
}

.my-message .message-time {
  color: rgba(255, 255, 255, 0.7);
}

.message-input-area {
  border-top: 1px solid #e0e0e0;
  min-height: 80px;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .conversations-sidebar {
    width: 100%;
    border-right: none;
  }

  .messages-area {
    display: none;
  }

  .conversation-item.active ~ .messages-area {
    display: flex;
  }
}
</style>
