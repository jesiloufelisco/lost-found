<script lang="ts" setup>
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import {
  formatDate,
  getItemStatusColor,
  getItemStatusText,
} from "@/utils/helpers";
import { supabase } from "@/lib/supabase";
import { useAuthUserStore } from "@/stores/authUser";
import { useToast } from "vue-toastification";
import {
  loadExistingConversation,
  createConversation,
} from "@/stores/conversation";
import {
  sendMessage as sendMessageToConversation,
  loadMessages as loadMessagesFromConversation,
  setupMessageSubscription as setupRealtimeSubscription,
} from "@/stores/messages";
import type { Message, Conversation } from "@/types/chat";

interface Item {
  id: number;
  title: string;
  description: string;
  status: "lost" | "found";
  user_id: string;
  claimed_by: string;
  created_at: string;
  user_email?: string;  // Add user email field
}

interface Props {
  item: Item;
  isUpdating: boolean;
}

const props = defineProps<Props>();

defineEmits<{
  contact: [id: number];
  markAsUnclaimed: [id: number];
}>();

const toast = useToast();

// Admin selection state
const showAdminSelectionDialog = ref(false);
const adminUsers = ref<any[]>([]);
const loadingAdmins = ref(false);
const selectedAdmin = ref<any>(null);

// Chat state
const showChatDialog = ref(false);
const conversation = ref<Conversation | null>(null);
const messages = ref<Message[]>([]);
const newMessage = ref("");
const messagesLoading = ref(false);
const sendingMessage = ref(false);
const currentUser = ref<any>(null);

// Real-time subscription
let messageSubscription: any = null;

// Get current user
const getCurrentUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  currentUser.value = user;
};

// Load admin users
const loadAdminUsers = async () => {
  loadingAdmins.value = true;
  try {
    const authStore = useAuthUserStore();
    const { users, error } = await authStore.getAllUsers();

    if (error) throw error;
    
    // Filter users with role 1 (admin role)
    adminUsers.value = (users || [])
      .filter(user => {
        const role = user.raw_app_meta_data?.role || user.raw_user_meta_data?.role;
        return role === 1;
      })
      .map(user => ({
        id: user.id,
        full_name: user.raw_user_meta_data?.full_name || user.email?.split('@')[0] || 'Admin User',
        email: user.email
      }));

    console.log('Loaded admin users:', adminUsers.value);
  } catch (error) {
    console.error('Error loading admin users:', error);
    toast.error('Failed to load admin users');
  } finally {
    loadingAdmins.value = false;
  }
};

// Load existing conversation and messages
const loadExistingConv = async () => {
  if (!currentUser.value || !selectedAdmin.value) return;

  messagesLoading.value = true;

  try {
    const existingConversation = await loadExistingConversation(
      props.item.id,
      currentUser.value.id,
      selectedAdmin.value.id
    );

    if (existingConversation) {
      conversation.value = existingConversation;
      await loadMessages();
      // Setup broadcast-enabled subscription
      setupMessageSubscription();
      console.log('Loaded existing conversation with broadcast enabled');
    }
  } catch (error) {
    console.error("Error loading existing conversation:", error);
    toast.error("Failed to load conversation");
  } finally {
    messagesLoading.value = false;
  }
};

// Load messages using the messages.ts function
const loadMessages = async () => {
  if (!conversation.value) return;

  try {
    const loadedMessages = await loadMessagesFromConversation(
      conversation.value.id
    );
    messages.value = loadedMessages;

    await nextTick();
    scrollToBottom();
  } catch (error) {
    console.error("Error loading messages:", error);
    toast.error("Failed to load messages");
  }
};

// Send message using the messages.ts function
const sendMessage = async () => {
  if (!newMessage.value.trim() || sendingMessage.value) return;

  if (!currentUser.value) {
    toast.error("Please log in to send messages");
    return;
  }

  const messageText = newMessage.value.trim();
  newMessage.value = "";
  sendingMessage.value = true;

  try {
    let currentConversation = conversation.value;

    // Create conversation if it doesn't exist
    if (!currentConversation) {
      if (!selectedAdmin.value) {
        toast.error('Please select an admin first');
        return;
      }
      currentConversation = await createConversation(
        props.item.id,
        currentUser.value.id,
        selectedAdmin.value.id
      );
      conversation.value = currentConversation;
      setupMessageSubscription();
      toast.success("Conversation started!");
    }

    // Ensure we have a conversation before proceeding
    if (!currentConversation) {
      throw new Error("Failed to create or get conversation");
    }

    // Send the message using the broadcast-enabled messages.ts function
    const sentMessage = await sendMessageToConversation(
      currentConversation.id,
      messageText,
      currentUser.value.id
    );

    // Add the message to the local array immediately if not already present
    const exists = messages.value.some(msg => msg.id === sentMessage.id);
    if (!exists) {
      messages.value.push(sentMessage);
    }
    await nextTick();
    scrollToBottom();
    console.log('Message sent and broadcast to conversation');
  } catch (error) {
    console.error("Error sending message:", error);
    toast.error("Failed to send message");
    newMessage.value = messageText;
  } finally {
    sendingMessage.value = false;
  }
};

// Setup real-time message subscription using broadcast-enabled messages.ts function
const setupMessageSubscription = () => {
  if (!conversation.value || messageSubscription || !currentUser.value) return;

  console.log('Setting up broadcast subscription for conversation:', conversation.value.id);

  messageSubscription = setupRealtimeSubscription(
    conversation.value.id,
    (newMessage: Message) => {
      // Prevent duplicates
      const exists = messages.value.some(msg => msg.id === newMessage.id);
      if (!exists) {
        messages.value.push(newMessage);
        nextTick(() => scrollToBottom());
        console.log('Received real-time message via broadcast');
      }
    },
    currentUser.value.id
  );
};

// Handle contact button click - opens admin selection dialog
const handleContact = async () => {
  if (!currentUser.value) {
    toast.error("Please log in to contact the admin");
    return;
  }

  showAdminSelectionDialog.value = true;
  await loadAdminUsers();
};

// Handle admin selection and open chat
const selectAdminAndOpenChat = async (admin: any) => {
  selectedAdmin.value = admin;
  showAdminSelectionDialog.value = false;
  showChatDialog.value = true;

  // Load existing conversation if it exists
  await loadExistingConv();
};

// Close admin selection dialog
const closeAdminSelection = () => {
  showAdminSelectionDialog.value = false;
  selectedAdmin.value = null;
};

// Close chat dialog
const closeChatDialog = () => {
  showChatDialog.value = false;
  conversation.value = null;
  messages.value = [];
  newMessage.value = "";
  selectedAdmin.value = null;

  // Cleanup broadcast subscription
  if (messageSubscription) {
    messageSubscription.unsubscribe();
    messageSubscription = null;
    console.log('Broadcast subscription cleaned up');
  }
};

// Scroll to bottom
const scrollToBottom = () => {
  const messagesContainer = document.querySelector(".messages-container");
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
};

// Handle key press
const handleKeyPress = (event: KeyboardEvent) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
};

// Check if message is from current user
const isMyMessage = (message: Message) => {
  return message.user_id === currentUser.value?.id;
};

// Initialize
onMounted(async () => {
  await getCurrentUser();
});

// Cleanup broadcast subscriptions on unmount
onUnmounted(() => {
  if (messageSubscription) {
    messageSubscription.unsubscribe();
    messageSubscription = null;
    console.log('ItemCard unmounted - broadcast subscription cleaned up');
  }
});
</script>

<template>
  <v-card class="item-card h-100" elevation="2">
    <v-card-title class="d-flex justify-space-between align-start">
      <div class="text-h6 font-weight-bold">{{ item.title }}</div>
      <v-chip :color="getItemStatusColor(item)" size="small" variant="flat">
        {{ getItemStatusText(item) }}
      </v-chip>
    </v-card-title>

    <v-card-text>
      <p class="text-body-2 mb-3">{{ item.description }}</p>

      <!-- User Email -->
      <div class="d-flex align-center text-caption text-grey-darken-1 mb-2">
        <v-icon size="16" class="me-1">mdi-account-circle</v-icon>
        Posted by: {{ item.user_email || 'Unknown user' }}
      </div>

      <!-- Created Date -->
      <div class="d-flex align-center text-caption text-grey-darken-1">
        <v-icon size="16" class="me-1">mdi-clock-outline</v-icon>
        {{ formatDate(item.created_at) }}
      </div>
    </v-card-text>

    <v-card-actions class="pt-0">
      <v-spacer />
      <v-btn
        color="primary"
        variant="flat"
        size="small"
        :prepend-icon="
          item.claimed_by ? 'mdi-check-circle' : 'mdi-message-text'
        "
        @click="handleContact"
        :loading="isUpdating"
        :disabled="!!item.claimed_by"
      >
        {{ item.claimed_by ? "Item Claimed" : "Contact Admin" }}
      </v-btn>
    </v-card-actions>

    <!-- Admin Selection Dialog -->
    <v-dialog v-model="showAdminSelectionDialog" max-width="500px" persistent>
      <v-card>
        <v-card-title class="d-flex align-center pa-4 bg-primary">
          <v-icon class="me-2 text-white">mdi-account-multiple</v-icon>
          <div class="text-white">
            <div class="text-h6">Select Admin to Chat</div>
            <div class="text-caption opacity-80">
              Choose an admin to discuss this {{ item.status }} item
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
    </v-dialog>

    <!-- Chat Dialog -->
    <v-dialog v-model="showChatDialog" max-width="600px" persistent>
      <v-card class="chat-dialog">
        <v-card-title class="d-flex align-center pa-4 bg-primary">
          <v-avatar color="white" size="40" class="me-3">
            <span class="text-primary font-weight-bold">
              {{ selectedAdmin ? (selectedAdmin.full_name ? selectedAdmin.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) : 'A') : 'A' }}
            </span>
          </v-avatar>
          <div class="text-white">
            <div class="text-h6">{{ selectedAdmin?.full_name || 'Admin' }}</div>
            <div class="text-caption opacity-80">
              Chat about: {{ item.title }} ({{ item.status }})
            </div>
          </div>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            color="white"
            @click="closeChatDialog"
          />
        </v-card-title>

        <div class="messages-container" style="height: 400px; overflow-y: auto">
          <!-- Loading messages -->
          <div
            v-if="messagesLoading"
            class="d-flex justify-center align-center pa-8"
          >
            <v-progress-circular indeterminate color="primary" />
            <span class="ml-3">Loading messages...</span>
          </div>

          <!-- Empty state -->
          <div v-else-if="messages.length === 0" class="text-center pa-8">
            <v-icon size="48" color="grey-lighten-1"
              >mdi-message-outline</v-icon
            >
            <div class="text-body-1 text-grey-darken-1 mt-2">
              Start the conversation by sending a message
            </div>
            <div class="text-caption text-grey-darken-2">
              Describe the item or ask questions to verify ownership
            </div>
          </div>

          <!-- Messages -->
          <div v-else class="pa-4">
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

        <v-card-actions class="pa-4 bg-grey-lighten-5">
          <v-text-field
            v-model="newMessage"
            placeholder="Type your message..."
            variant="outlined"
            density="comfortable"
            hide-details
            @keypress="handleKeyPress"
            :disabled="sendingMessage"
            append-inner-icon="mdi-send"
            @click:append-inner="sendMessage"
          />
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<style scoped>
.item-card {
 transition: transform 0.2s ease-in-out;
}

.item-card:hover {
 transform: translateY(-2px);
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

.chat-dialog {
 border-radius: 12px !important;
 overflow: hidden;
}

.messages-container {
 /* In a proper dark mode setup, this background should change.
     For now, we ensure message text is readable. */
 background: #f5f5f5;
}

.message-bubble {
 display: flex;
}

.message-bubble.my-message {
 justify-content: flex-end;
}

.message-content {
 max-width: 70%;
 background: white;
 border-radius: 18px;
 padding: 12px 16px;
 box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
 color: #212121;
}

.my-message .message-content {
 background: #1b5e20;
 color: white;
}

.message-text {
 font-size: 14px;
 line-height: 1.4;
 word-wrap: break-word;
}

.message-time {
 font-size: 11px;
 opacity: 0.7;
 margin-top: 4px;
 text-align: right;
 color: #616161;
}

.my-message .message-time {

 color: rgba(255, 255, 255, 0.7);
}
</style>
