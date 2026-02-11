<script lang="ts" setup>
import { formatDate } from '@/utils/helpers'

interface Item {
  id: number
  title: string
  description: string
  status: 'lost' | 'found'
  user_id: string
  claimed_by: string
  created_at: string
  user_email?: string  // Add user email field
}

interface Props {
  item: Item
  isUpdating: boolean
}

defineProps<Props>()

defineEmits<{
  openConversations: [item: Item]
  markAsClaimed: [id: number]
  markAsUnclaimed: [id: number]
}>()

const getItemStatusColor = (item: Item) => {
  if (item.claimed_by) return 'success'
  return item.status === 'lost' ? 'error' : 'info'
}

const getItemStatusText = (item: Item) => {
  if (item.claimed_by) return 'Claimed'
  return item.status === 'lost' ? 'Lost' : 'Found'
}

const getItemStatusIcon = (item: Item) => {
  if (item.claimed_by) return 'mdi-check-circle'
  return item.status === 'lost' ? 'mdi-alert-circle' : 'mdi-information'
}
</script>

<template>
  <v-card class="item-card h-100" elevation="2">
    <v-card-title class="d-flex justify-space-between align-start">
      <div class="text-h6 font-weight-bold">{{ item.title }}</div>
      <v-chip
        :color="getItemStatusColor(item)"
        size="small"
        variant="flat"
        :prepend-icon="getItemStatusIcon(item)"
      >
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

    <v-card-actions class="pt-0 d-flex gap-2">
      <!-- Open Conversations button - always visible for admins -->
      <v-btn
        color="primary"
        variant="flat"
        size="small"
        prepend-icon="mdi-message-text-outline"
        @click="$emit('openConversations', item)"
        :loading="isUpdating"
      >
        Open Conversations
      </v-btn>

      <v-spacer />

      <!-- Admin controls for managing item status -->
      <!-- <v-btn
        v-if="!item.claimed_by"
        color="success"
        variant="outlined"
        size="small"
        prepend-icon="mdi-check"
        @click="$emit('markAsClaimed', item.id)"
        :loading="isUpdating"
      >
        Mark as Claimed
      </v-btn>
      <v-btn
        v-else
        color="warning"
        variant="outlined"
        size="small"
        prepend-icon="mdi-undo"
        @click="$emit('markAsUnclaimed', item.id)"
        :loading="isUpdating"
      >
        Mark as Unclaimed
      </v-btn> -->
    </v-card-actions>
  </v-card>
</template>

<style scoped>
.item-card {
  transition: transform 0.2s ease-in-out;
  border-radius: 12px;
}

.item-card:hover {
  transform: translateY(-2px);
}

.v-chip {
  border-radius: 8px;
}

.gap-2 {
  gap: 8px;
}
</style>
