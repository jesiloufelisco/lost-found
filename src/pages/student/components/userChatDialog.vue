//userChatDialog.vue
<script setup lang="ts">
import { ref, watchEffect, toRefs } from 'vue'
import { formatDate } from '@/utils/helpers'
import { supabase } from '@/lib/supabase'

// Define the interfaces here to make the component props type-safe
interface Item {
id: number
title: string
status: 'lost' | 'found'
}

interface Message {
id: string
conversation_id: string
message: string
user_id: string
created_at: string
}

const props = defineProps({
show: { type: Boolean, required: true },
// Use a type assertion to specify the shape of the item object
item: { type: Object as () => Item | null, required: true },
// Use a type assertion to specify the messages array contains Message objects
messages: { type: Array as () => Message[], required: true },
messagesLoading: { type: Boolean, required: true },
sendingMessage: { type: Boolean, required: true },
})
const emit = defineEmits(['update:show', 'send-message'])

const { show, item, messages, messagesLoading, sendingMessage } = toRefs(props)
const newMessage = ref('')
const currentUser = ref<any>(null)

// Get the current user on mount to check who sent the message
watchEffect(async () => {
if (show.value) {
const { data: { user } } = await supabase.auth.getUser()
currentUser.value = user
}
})

const handleKeyPress = (event: KeyboardEvent) => {
if (event.key === 'Enter' && !event.shiftKey) {
event.preventDefault()
sendMessage()
}
}

const sendMessage = () => {
if (newMessage.value.trim()) {
emit('send-message', newMessage.value)
newMessage.value = ''
}
}

// The message parameter is now type-safe
const isMyMessage = (message: Message) => {
return message.user_id === currentUser.value?.id
}

const closeDialog = () => {
emit('update:show', false)
}
</script>

<template>
<v-dialog :model-value="show" max-width="600px" persistent>
<v-card class="chat-dialog">
<v-card-title class="d-flex align-center pa-4 bg-primary">
<v-icon class="me-2 text-white">mdi-message-text</v-icon>
<div class="text-white">
<div class="text-h6">{{ item?.title }}</div>
<div class="text-caption opacity-80">
Chat about this {{ item?.status }} item
</div>
</div>
<v-spacer />
<v-btn icon="mdi-close" variant="text" color="white" @click="closeDialog" />
</v-card-title>

  <div class="messages-container" style="height: 400px; overflow-y: auto;">
    <div v-if="messagesLoading" class="d-flex justify-center align-center pa-8">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <div v-else-if="messages.length === 0" class="text-center pa-8">
      <v-icon size="48" color="grey-lighten-1">mdi-message-outline</v-icon>
      <div class="text-body-1 text-grey-darken-1 mt-2">
        Start the conversation by sending a message
      </div>
    </div>
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
  </v-card-actions>
</v-card>

</v-dialog>
</template>