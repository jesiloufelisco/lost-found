// useNotifications.ts - Composable for notification utilities
import { computed, ref, onUnmounted } from 'vue'
import { useNotificationsStore } from '@/stores/notificationsData'
import { useUserNotificationsStore } from '@/stores/userNotificationsData'
import { useAuthUserStore } from '@/stores/authUser'
import { supabase } from '@/lib/supabase'
import { useToast, POSITION } from 'vue-toastification'

export function useNotifications() {
  const notificationsStore = useNotificationsStore()
  const userNotificationsStore = useUserNotificationsStore()
  const authStore = useAuthUserStore()
  const toast = useToast()

  // Real-time subscription references
  let notificationsChannel: any = null
  let userNotificationsChannel: any = null

  // Computed properties
  const currentUserId = computed(() => authStore.userData?.id)
  const isAdmin = computed(() => authStore.userRoleId === 1)
  const unreadCount = computed(() => userNotificationsStore.unreadCount)
  const hasUnreadNotifications = computed(() => userNotificationsStore.hasUnreadNotifications)

  // Notification management functions
  async function createAndSendNotification(
    title: string,
    description: string,
    userIds: string[]
  ) {
    try {
      // Create the notification
      const createResult = await notificationsStore.createNotification({
        title,
        description
      })

      if (createResult.error || !createResult.data) {
        return { error: createResult.error }
      }

      // Send to specified users
      const sendResult = await userNotificationsStore.sendNotificationToUsers(
        createResult.data.id!,
        userIds
      )

      return sendResult
    } catch (error) {
      return { error }
    }
  }

  // Send notification to all users (admin only)
  async function broadcastNotification(title: string, description: string) {
    if (!isAdmin.value) {
      return { error: new Error('Only admins can broadcast notifications') }
    }

    try {
      // Get all users first (this would need to be implemented in authStore)
      const usersResult = await authStore.getAllUsers()

      if (usersResult.error || !usersResult.users) {
        return { error: usersResult.error }
      }

      const userIds = usersResult.users.map(user => user.id).filter(Boolean)

      return await createAndSendNotification(title, description, userIds)
    } catch (error) {
      return { error }
    }
  }

  // Quick actions for current user
  async function loadMyNotifications() {
    if (!currentUserId.value) return { error: new Error('User not authenticated') }

    return await userNotificationsStore.getUserNotifications(currentUserId.value)
  }

  async function markAllMyNotificationsAsRead() {
    if (!currentUserId.value) return { error: new Error('User not authenticated') }

    return await userNotificationsStore.markAllAsRead(currentUserId.value)
  }

  async function getMyUnreadCount() {
    if (!currentUserId.value) return { count: 0 }

    const result = await userNotificationsStore.getUnreadCount(currentUserId.value)
    return result
  }

  // Utility functions
  function formatNotificationTime(dateString?: string) {
    if (!dateString) return 'Unknown time'

    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h ago`

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d ago`

    return date.toLocaleDateString()
  }

  function getNotificationIcon(title?: string) {
    if (!title) return '📢'

    const lowerTitle = title.toLowerCase()

    if (lowerTitle.includes('message') || lowerTitle.includes('chat')) return '💬'
    if (lowerTitle.includes('alert') || lowerTitle.includes('warning')) return '⚠️'
    if (lowerTitle.includes('success') || lowerTitle.includes('complete')) return '✅'
    if (lowerTitle.includes('error') || lowerTitle.includes('fail')) return '❌'
    if (lowerTitle.includes('info') || lowerTitle.includes('update')) return 'ℹ️'
    if (lowerTitle.includes('reminder')) return '⏰'
    if (lowerTitle.includes('welcome')) return '👋'

    return '📢'
  }

  // Real-time notification setup
  function setupRealtimeNotifications() {
    if (!currentUserId.value) {
      console.warn('Cannot setup real-time notifications: User not authenticated')
      return
    }

    // Clean up existing subscriptions
    teardownRealtimeNotifications()

    // Subscribe to new notifications
    notificationsChannel = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          console.log('New notification received!', payload)

          // Add to local store
          if (payload.new) {
            notificationsStore.notifications.unshift(payload.new)
          }

          // Show toast notification for new broadcasts
          if (payload.new?.title) {
            toast.info(`📢 ${payload.new.title}`, {
              position: POSITION.TOP_RIGHT,
              timeout: 5000,
              hideProgressBar: false,
            })
          }
        }
      )
      .subscribe()

    // Subscribe to user notifications (when notifications are assigned to users)
    userNotificationsChannel = supabase
      .channel('user-notifications-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${currentUserId.value}`
        },
        async (payload) => {
          console.log('New user notification received!', payload)

          if (payload.new) {
            // Fetch the complete notification with joined data
            const result = await userNotificationsStore.getUserNotificationById(payload.new.id)

            if (result.data) {
              // Add to local store
              userNotificationsStore.userNotifications.unshift(result.data)

              // Show toast notification
              const title = result.data.notification?.title || 'New Notification'
              toast.success(`🔔 ${title}`, {
                position: POSITION.TOP_RIGHT,
                timeout: 7000,
                hideProgressBar: false,
              })
            }
          }
        }
      )
      .subscribe()

    console.log('Real-time notifications setup completed')
  }

  function teardownRealtimeNotifications() {
    if (notificationsChannel) {
      supabase.removeChannel(notificationsChannel)
      notificationsChannel = null
    }

    if (userNotificationsChannel) {
      supabase.removeChannel(userNotificationsChannel)
      userNotificationsChannel = null
    }

    console.log('Real-time notifications cleaned up')
  }

  // Auto cleanup on component unmount
  onUnmounted(() => {
    teardownRealtimeNotifications()
  })

  return {
    // Stores
    notificationsStore,
    userNotificationsStore,

    // Computed
    currentUserId,
    isAdmin,
    unreadCount,
    hasUnreadNotifications,

    // Actions
    createAndSendNotification,
    broadcastNotification,
    loadMyNotifications,
    markAllMyNotificationsAsRead,
    getMyUnreadCount,

    // Utilities
    formatNotificationTime,
    getNotificationIcon,
    setupRealtimeNotifications,
    teardownRealtimeNotifications,
  }
}
