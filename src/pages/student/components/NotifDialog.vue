<script lang="ts" setup>
import { computed } from 'vue'
import { formatDate, getStatusIcon, getStatusColor } from '@/utils/helpers'

type LocalNotification = {
  id: number
  title: string
  status: 'lost' | 'found'
  created_at: string
  read: boolean
  type: 'local'
}

type GlobalNotification = {
  id?: number
  user_id?: string
  notification_id?: number
  is_read?: boolean
  created_at?: string
  notification?: {
    id: number
    title?: string
    description?: string
    created_at?: string
  }
  type: 'global'
}

type CombinedNotification = LocalNotification | GlobalNotification

interface Props {
  modelValue: boolean
  notifications: LocalNotification[]
  globalNotifications?: GlobalNotification[]
}

const props = withDefaults(defineProps<Props>(), {
  globalNotifications: () => []
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'mark-as-read': [id: number]
  'mark-global-as-read': [id: number]
  'clear-all': []
}>()

// Combine and transform notifications
const allNotifications = computed<CombinedNotification[]>(() => {
  const local: LocalNotification[] = props.notifications.map(n => ({ ...n, type: 'local' as const }))
  const global: GlobalNotification[] = props.globalNotifications.map(n => ({ ...n, type: 'global' as const }))

  return [...local, ...global]
})

const unreadCount = computed(() => {
  return allNotifications.value.filter(n => {
    if (n.type === 'local') return !n.read
    return !n.is_read
  }).length
})

const sortedNotifications = computed(() => {
  return [...allNotifications.value].sort((a, b) => {
    // Unread first
    const aUnread = a.type === 'local' ? !a.read : !a.is_read
    const bUnread = b.type === 'local' ? !b.read : !b.is_read

    if (aUnread !== bUnread) {
      return aUnread ? -1 : 1
    }

    // Then by date - handle undefined created_at values
    const aCreatedAt = a.created_at || new Date().toISOString()
    const bCreatedAt = b.created_at || new Date().toISOString()
    const aDate = new Date(aCreatedAt).getTime()
    const bDate = new Date(bCreatedAt).getTime()
    return bDate - aDate
  })
})

const handleMarkAsRead = (notification: CombinedNotification) => {
  if (notification.type === 'local' && !notification.read) {
    emit('mark-as-read', notification.id)
  } else if (notification.type === 'global' && !notification.is_read && notification.id) {
    emit('mark-global-as-read', notification.id)
  }
}

const handleClearAll = () => {
  emit('clear-all')
}

const getNotificationTitle = (notification: CombinedNotification): string => {
  if (notification.type === 'local') {
    return notification.title
  }
  return notification.notification?.title || 'New Notification'
}

const getNotificationDescription = (notification: CombinedNotification): string => {
  if (notification.type === 'local') {
    return `${notification.status.charAt(0).toUpperCase() + notification.status.slice(1)} item notification`
  }
  return notification.notification?.description || ''
}

const getNotificationIcon = (notification: CombinedNotification): string => {
  if (notification.type === 'local') {
    return getStatusIcon(notification.status)
  }
  return 'mdi-bell'
}

const getNotificationColor = (notification: CombinedNotification): string => {
  if (notification.type === 'local') {
    return getStatusColor(notification.status)
  }
  return 'primary'
}

const safeFormatDate = (dateString?: string): string => {
  if (!dateString) return 'Unknown time'
  return formatDate(dateString)
}

const closeDialog = () => {
  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="500px"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <div class="d-flex align-center">
          <v-icon class="me-2" color="primary">mdi-bell</v-icon>
          Notifications
          <v-chip
            v-if="unreadCount > 0"
            color="error"
            size="small"
            variant="flat"
            class="ml-2"
          >
            {{ unreadCount }} new
          </v-chip>
        </div>
        <v-btn
          icon
          variant="text"
          size="small"
          @click="closeDialog"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider />

      <v-card-text class="pa-0" style="max-height: 400px;">
        <div v-if="allNotifications.length === 0" class="text-center py-8">
          <v-icon size="64" color="grey-lighten-1">mdi-bell-off</v-icon>
          <div class="text-h6 text-grey-darken-1 mt-2">No notifications yet</div>
          <div class="text-body-2 text-grey-darken-1">
            You'll be notified when admins post new items
          </div>
        </div>

        <v-list v-else class="py-0">
          <v-list-item
            v-for="(notification, index) in sortedNotifications"
            :key="`${notification.type}-${notification.id || index}`"
            @click="handleMarkAsRead(notification)"
            :class="{
              'bg-blue-lighten-5': notification.type === 'local' ? !notification.read : !notification.is_read
            }"
            class="notification-item"
          >
            <template #prepend>
              <v-avatar :color="getNotificationColor(notification)" size="40">
                <v-icon color="white">
                  {{ getNotificationIcon(notification) }}
                </v-icon>
              </v-avatar>
            </template>

            <v-list-item-title class="d-flex align-center">
              <span class="flex-grow-1">{{ getNotificationTitle(notification) }}</span>
              <v-chip
                v-if="notification.type === 'local' ? !notification.read : !notification.is_read"
                color="primary"
                size="x-small"
                dot
                class="ml-2"
              />
            </v-list-item-title>

            <v-list-item-subtitle class="d-flex align-center justify-space-between">
              <span>
                <v-chip
                  :color="getNotificationColor(notification)"
                  size="small"
                  variant="tonal"
                  class="me-2"
                >
                  {{ notification.type === 'local'
                      ? (notification.status === 'lost' ? 'Lost' : 'Found')
                      : 'Announcement'
                  }}
                </v-chip>
                {{ getNotificationDescription(notification) }}
              </span>
              <span class="text-caption">
                {{ safeFormatDate(notification.created_at) }}
              </span>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card-text>

      <v-divider v-if="allNotifications.length > 0" />

      <v-card-actions v-if="allNotifications.length > 0">
        <v-btn
          v-if="unreadCount > 0"
          color="primary"
          variant="text"
          size="small"
          @click="sortedNotifications.forEach(n => handleMarkAsRead(n))"
        >
          Mark all as read
        </v-btn>
        <v-spacer />
        <v-btn
          color="error"
          variant="text"
          size="small"
          @click="handleClearAll"
        >
          Clear all
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.notification-item {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.notification-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.bg-blue-lighten-5 {
  background-color: rgba(33, 150, 243, 0.08);
}

.bg-blue-lighten-5:hover {
  background-color: rgba(33, 150, 243, 0.12);
}
</style>
