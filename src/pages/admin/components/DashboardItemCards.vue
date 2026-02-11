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
}

interface Props {
  item: Item
  isUpdating: boolean
}

defineProps<Props>()

defineEmits<{
  showClaimDialog: [item: Item]
  deleteItem: [item: Item]
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
      <div class="d-flex align-center gap-2">
        <v-chip
          :color="getItemStatusColor(item)"
          size="small"
          variant="flat"
          :prepend-icon="getItemStatusIcon(item)"
        >
          {{ getItemStatusText(item) }}
        </v-chip>
        <v-btn
          icon="mdi-delete"
          size="small"
          color="error"
          variant="text"
          :loading="isUpdating"
          @click="$emit('deleteItem', item)"
        />
      </div>
    </v-card-title>

    <v-card-text>
      <p class="text-body-2 mb-3">{{ item.description }}</p>
      <div class="d-flex align-center text-caption text-grey-darken-1">
        <v-icon size="16" class="me-1">mdi-clock-outline</v-icon>
        {{ formatDate(item.created_at) }}
      </div>
    </v-card-text>

    <v-card-actions class="pt-0 d-flex gap-2">
      <!-- Dashboard admin controls for managing item status -->
      <v-btn
        v-if="!item.claimed_by"
        color="success"
        variant="flat"
        size="small"
        prepend-icon="mdi-check"
        @click="$emit('showClaimDialog', item)"
        :loading="isUpdating"
      >
        Mark as Claimed
      </v-btn>
      <v-chip
        v-else
        color="success"
        variant="flat"
        size="small"
        prepend-icon="mdi-check-circle"
      >
        Item Claimed
      </v-chip>
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

.v-btn--icon.v-btn--size-small {
  width: 32px;
  height: 32px;
}
</style>
