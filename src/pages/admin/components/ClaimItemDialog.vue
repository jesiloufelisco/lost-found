<script lang="ts" setup>
import { ref, watch } from 'vue'
import { loadConversationsForItem } from '@/stores/conversation'

interface Item {
  id: number
  title: string
  description: string
  status: 'lost' | 'found'
  user_id: string
  claimed_by: string
  created_at: string
}

interface Conversation {
  id: string
  sender_id: string
  sender?: {
    id: string
    email: string
  }
}

interface Props {
  modelValue: boolean
  item: Item | null
  loading: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'claim-item': [itemId: number, claimedBy: string]
}>()

const conversations = ref<Conversation[]>([])
const loadingConversations = ref(false)
const selectedClaimant = ref<string>('')

// Load conversations when dialog opens using store function
const loadConversations = async (itemId: number) => {
  loadingConversations.value = true
  try {
    const conversationData = await loadConversationsForItem(itemId)

    // Get unique senders (people who contacted about this item)
    const uniqueSenders = new Map()
    conversationData?.forEach(conv => {
      uniqueSenders.set(conv.sender_id, conv)
    })

    conversations.value = Array.from(uniqueSenders.values())

  } catch (error) {
    console.error('Error loading conversations:', error)
    conversations.value = []
  } finally {
    loadingConversations.value = false
  }
}

// Watch for dialog opening
watch(
  () => ({ isOpen: props.modelValue, item: props.item }),
  ({ isOpen, item }) => {
    if (isOpen && item) {
      loadConversations(item.id)
      selectedClaimant.value = ''
    }
  }
)

const closeDialog = () => {
  emit('update:modelValue', false)
  conversations.value = []
  selectedClaimant.value = ''
}

const confirmClaim = () => {
  if (selectedClaimant.value && props.item) {
    emit('claim-item', props.item.id, selectedClaimant.value)
    closeDialog()
  }
}
</script>

<template>
  <v-dialog 
    :model-value="modelValue" 
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="600px"
    persistent
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="me-2" color="success">mdi-check-circle</v-icon>
        Mark Item as Claimed
      </v-card-title>

      <v-card-subtitle v-if="item">
        {{ item.title }}
      </v-card-subtitle>

      <v-card-text>
        <div v-if="loadingConversations" class="text-center py-4">
          <v-progress-circular indeterminate color="primary" />
          <div class="mt-2">Loading people who contacted about this item...</div>
        </div>

        <div v-else-if="conversations.length === 0" class="text-center py-4">
          <v-icon size="48" color="grey-lighten-1">mdi-account-off</v-icon>
          <div class="text-h6 mt-2">No contacts found</div>
          <div class="text-body-2 text-grey-darken-1">
            No one has contacted about this item yet.
          </div>
        </div>

        <div v-else>
          <div class="text-subtitle-1 mb-3">
            Select the person who should be marked as the claimer:
          </div>

          <v-radio-group v-model="selectedClaimant">
            <v-radio
              v-for="conversation in conversations"
              :key="conversation.sender_id"
              :value="conversation.sender_id"
              color="success"
            >
              <template #label>
                <div class="d-flex align-center">
                  <v-avatar size="32" color="primary" class="me-3">
                    <span class="text-white text-body-2">
                      {{ conversation.sender?.email?.charAt(0).toUpperCase() || '?' }}
                    </span>
                  </v-avatar>
                  <div>
                    <div class="font-weight-medium">
                      {{ conversation.sender?.email || 'Unknown User' }}
                    </div>
                    <div class="text-caption text-grey-darken-1">
                      User ID: {{ conversation.sender_id }}
                    </div>
                  </div>
                </div>
              </template>
            </v-radio>
          </v-radio-group>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="closeDialog"
        >
          Cancel
        </v-btn>
        <v-btn
          color="success"
          variant="flat"
          :disabled="!selectedClaimant || conversations.length === 0"
          :loading="loading"
          @click="confirmClaim"
        >
          Mark as Claimed
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.v-radio-group :deep(.v-selection-control) {
  align-items: flex-start;
}

.v-radio-group :deep(.v-selection-control__wrapper) {
  margin-top: 8px;
}
</style>