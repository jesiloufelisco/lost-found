<script lang="ts" setup>
import { ref, watch, computed } from "vue";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/utils/helpers";
import { fetchConversations } from "@/stores/conversation";
import { markAsClaimedBy } from "@/stores/items";

interface Item {
  id: number;
  title: string;
  description: string;
  status: "lost" | "found";
  user_id: string;
  claimed_by: string;
  created_at: string;
}

interface Conversation {
  id: number;
  item_id: number;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  sender_profile: {
    full_name: string;
    email: string;
  } | null;
  messages?: Array<{
    message: string;
    created_at: string;
  }>;
  latest_message: {
    message: string;
    created_at: string;
  };
  message_count: number;
}

interface Props {
  modelValue: boolean;
  item: Item | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const conversations = ref<Conversation[]>([]);
const loading = ref(false);
const selectedConversation = ref<Conversation | null>(null);
const showChatDialog = ref(false);

const dialogValue = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value),
});

// Open chat dialog for specific conversation
const openChat = (conversation: Conversation) => {
  selectedConversation.value = conversation;
  showChatDialog.value = true;
};

// Mark item as claimed by specific user
const handleAwardItem = async (conversation: Conversation) => {
  if (!props.item) return;

  try {
    await markAsClaimedBy(props.item.id, conversation.sender_id);
    
    // Close dialogs and refresh
    dialogValue.value = false;
    // You might want to emit an event here to refresh the parent component
  } catch (error) {
    console.error("Error:", error);
  }
};

// Watch for dialog opening
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue && props.item) {
      fetchConversations(props.item.id); 
    }
  }
);
</script>

<template>
  <v-dialog v-model="dialogValue" max-width="800px" persistent>
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <div class="d-flex align-center">
          <v-icon class="me-2" color="primary">mdi-message-text-outline</v-icon>
          <div>
            <div class="text-h6">Conversations for "{{ item?.title }}"</div>
            <div class="text-caption text-grey-darken-1">
              Users interested in claiming this item
            </div>
          </div>
        </div>
        <v-btn icon @click="dialogValue = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider />

      <v-card-text class="pa-0">
        <!-- Loading State -->
        <div v-if="loading" class="d-flex justify-center align-center py-8">
          <v-progress-circular indeterminate color="primary" />
          <span class="ml-3">Loading conversations...</span>
        </div>

        <!-- Empty State -->
        <div v-else-if="conversations.length === 0" class="text-center py-8">
          <v-icon size="64" color="grey-lighten-1"
            >mdi-message-off-outline</v-icon
          >
          <div class="text-h6 text-grey-darken-1 mt-2">
            No conversations yet
          </div>
          <div class="text-body-2 text-grey-darken-2">
            No users have contacted you about this item yet.
          </div>
        </div>

        <!-- Conversations List -->
        <div v-else>
          <v-list>
            <v-list-item
              v-for="conversation in conversations"
              :key="conversation.id"
              class="conversation-item"
            >
              <template #prepend>
                <v-avatar color="primary" class="text-white">
                  {{ conversation.sender_profile?.full_name?.charAt(0) || "U" }}
                </v-avatar>
              </template>

              <v-list-item-title>
                {{ conversation.sender_profile?.full_name || "Unknown User" }}
              </v-list-item-title>

              <v-list-item-subtitle class="mt-1">
                <div class="d-flex align-center mb-1">
                  <v-icon size="12" class="me-1">mdi-email</v-icon>
                  {{ conversation.sender_profile?.email || "No email" }}
                </div>
                <div class="latest-message">
                  {{ conversation.latest_message?.message }}
                </div>
                <div class="d-flex align-center justify-space-between mt-2">
                  <div class="text-caption text-grey-darken-1">
                    <v-icon size="12" class="me-1">mdi-clock-outline</v-icon>
                    {{
                      formatDate(
                        conversation.latest_message?.created_at ||
                          conversation.created_at
                      )
                    }}
                  </div>
                  <v-chip size="x-small" color="info" variant="tonal">
                    {{ conversation.message_count }} messages
                  </v-chip>
                </div>
              </v-list-item-subtitle>

              <template #append>
                <div class="d-flex flex-column ga-2">
                  <v-btn
                    color="primary"
                    variant="outlined"
                    size="small"
                    prepend-icon="mdi-message-text"
                    @click="openChat(conversation)"
                  >
                    View Chat
                  </v-btn>
                  <v-btn
                    color="success"
                    variant="flat"
                    size="small"
                    prepend-icon="mdi-check"
                    @click="handleAwardItem(conversation)"
                  >
                    Award Item
                  </v-btn>
                </div>
              </template>
            </v-list-item>
          </v-list>
        </div>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-spacer />
        <v-btn variant="outlined" @click="dialogValue = false"> Close </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Chat Dialog (Simple version - you might want to create a separate component) -->
  <v-dialog v-model="showChatDialog" max-width="600px">
    <v-card v-if="selectedConversation">
      <v-card-title class="d-flex align-center justify-space-between">
        <div>
          <div class="text-h6">
            Chat with {{ selectedConversation.sender_profile?.full_name }}
          </div>
          <div class="text-caption text-grey-darken-1">
            About "{{ item?.title }}"
          </div>
        </div>
        <v-btn icon @click="showChatDialog = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text>
        <div class="text-center text-grey-darken-1 py-4">
          <v-icon size="48" class="mb-2">mdi-chat-outline</v-icon>
          <div>This will redirect to the full chat interface</div>
          <div class="text-caption mt-2">
            Conversation ID: {{ selectedConversation.id }}
          </div>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="outlined" @click="showChatDialog = false">
          Close
        </v-btn>
        <v-btn color="primary" @click="showChatDialog = false">
          Open Full Chat
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.conversation-item {
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.conversation-item:last-child {
  border-bottom: none;
}

.latest-message {
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.6);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.v-list-item {
  min-height: 100px;
  padding: 16px;
}
</style>