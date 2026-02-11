<script setup lang="ts">
import { ref, toRefs, watchEffect } from "vue";
import { formatDate } from "@/utils/helpers";
import { supabase } from "@/lib/supabase";
import type { Conversation, Message, Item } from "@/types/chat"; 

const props = defineProps<{
  show: boolean;
  item: { id: number; title: string } | null; 
  conversations: Conversation[];
  messages: Message[];
  selectedConversation: Conversation | null;
  loadingConversations: boolean;
  loadingMessages: boolean;
  sendingMessage: boolean;
}>();

const emit = defineEmits([
  "update:show",
  "select-conversation",
  "send-message",
]);

const {
  show,
  item,
  conversations,
  messages,
  selectedConversation,
  loadingConversations,
  loadingMessages,
  sendingMessage,
} = toRefs(props);

const newMessage = ref("");
const currentUser = ref<any>(null);

// Get the current user on mount
watchEffect(async () => {
  if (show.value) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    currentUser.value = user;
  }
});

const handleKeyPress = (event: KeyboardEvent) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
};

// Emit to parent instead of mutating props
const sendMessage = async () => {
  if (
    !newMessage.value.trim() ||
    !selectedConversation.value ||
    !currentUser.value
  )
    return;

  emit("send-message", {
    conversationId: selectedConversation.value.id,
    message: newMessage.value.trim(),
    userId: currentUser.value.id,
  });

  newMessage.value = "";
};

const isMyMessage = (message: Message) => {
  return message.user_id === currentUser.value?.id;
};

const closeDialog = () => {
  emit("update:show", false);
};
</script>

<template>
  <v-dialog :model-value="show" max-width="800px" persistent>
    <v-card class="admin-conversations-dialog">
      <v-card-title class="d-flex align-center pa-4 bg-primary">
        <v-icon class="me-2 text-white">mdi-forum</v-icon>
        <div class="text-white">
          <div class="text-h6">Conversations</div>
          <div class="text-caption opacity-80">
            {{ item?.title }}
          </div>
        </div>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          color="white"
          @click="closeDialog"
        />
      </v-card-title>

      <div class="d-flex" style="height: 500px">
        <div
          class="conversations-list"
          style="
            width: 300px;
            border-right: 1px solid #e0e0e0;
            overflow-y: auto;
          "
        >
          <div
            v-if="loadingConversations"
            class="d-flex justify-center align-center pa-8"
          >
            <v-progress-circular indeterminate color="primary" size="32" />
          </div>
          <div v-else-if="conversations.length === 0" class="text-center pa-8">
            <v-icon size="48" color="grey-lighten-1"
              >mdi-message-outline</v-icon
            >
            <div class="text-body-2 text-grey-darken-1 mt-2">
              No conversations yet
            </div>
          </div>
          <v-list v-else class="pa-0">
            <v-list-item
              v-for="conversation in conversations"
              :key="conversation.id"
              @click="emit('select-conversation', conversation)"
              :active="selectedConversation?.id === conversation.id"
              class="conversation-item"
            >
              <v-list-item-title class="text-subtitle-2">{{
                conversation.sender?.email
              }}</v-list-item-title>
              <v-list-item-subtitle class="text-caption">{{
                formatDate(conversation.created_at)
              }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </div>

        <div class="flex-grow-1 d-flex flex-column">
          <div
            v-if="!selectedConversation"
            class="d-flex justify-center align-center flex-grow-1"
          >
            <div class="text-center">
              <v-icon size="64" color="grey-lighten-1"
                >mdi-message-text-outline</v-icon
              >
              <div class="text-body-1 text-grey-darken-1 mt-2">
                Select a conversation to view messages
              </div>
            </div>
          </div>
          <template v-else>
            <div
              class="admin-messages-container flex-grow-1 pa-4"
              style="overflow-y: auto"
            >
              <div
                v-if="loadingMessages"
                class="d-flex justify-center align-center pa-8"
              >
                <v-progress-circular indeterminate color="primary" />
              </div>
              <div v-else-if="messages.length === 0" class="text-center pa-8">
                <div class="text-body-2 text-grey-darken-1">
                  No messages in this conversation yet
                </div>
              </div>
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

            <div
              class="pa-4 bg-grey-lighten-5"
              style="border-top: 1px solid #e0e0e0"
            >
              <div class="d-flex align-center">
                <v-text-field
                  v-model="newMessage"
                  placeholder="Type your message..."
                  variant="outlined"
                  density="compact"
                  hide-details
                  @keypress="handleKeyPress"
                  :disabled="sendingMessage"
                />
                <v-btn
                  color="primary"
                  icon="mdi-send"
                  :loading="sendingMessage"
                  :disabled="!newMessage.trim()"
                  @click="sendMessage"
                  class="ml-2"
                />
              </div>
            </div>
          </template>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.conversation-item {
 cursor: pointer;
 border-bottom: 1px solid #f5f5f5;
}

.conversation-item:hover {
background-color: rgb(var(--v-theme-primary) / 0.08);}

.message-bubble {
 display: flex;
 margin-bottom: 12px;
}

.message-bubble.my-message {
 justify-content: flex-end;
}

.message-content {
 max-width: 70%;
 padding: 12px 16px;
 border-radius: 18px;
 background-color: #f1f3f4;
 /* 💡 FIX 1: Set text color for non-user message to a dark color */
 color: #212121;
}

.my-message .message-content {
 background-color: #1b5e20;
 /* The message text is already white, but explicitly setting it is good practice */
 color: white;
}

.message-text {
 word-wrap: break-word;
}

.message-time {
 font-size: 0.75rem;
 opacity: 0.7;
 margin-top: 4px;
 /* 💡 FIX 2: Set timestamp color for non-user message (light bubble) to a darker grey */
 color: #616161;
}

.my-message .message-time {
 /* 💡 FIX 3: Set timestamp color for user message (dark green bubble) to a light color */
 color: rgba(255, 255, 255, 0.7);
}

.admin-messages-container {
 scrollbar-width: thin;
 scrollbar-color: #ccc transparent;
}

.admin-messages-container::-webkit-scrollbar {
 width: 6px;
}

.admin-messages-container::-webkit-scrollbar-track {
 background: transparent;
}

.admin-messages-container::-webkit-scrollbar-thumb {
 background-color: #ccc;
 border-radius: 3px;
}
</style>
