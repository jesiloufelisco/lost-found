import { ref, onUnmounted, type Ref } from 'vue'
import { useToast, POSITION } from 'vue-toastification'
import { supabase } from '@/lib/supabase'
import { useAuthUserStore } from '@/stores/authUser'

interface Item {
  id: number
  title: string
  description: string
  status: 'lost' | 'found'
  user_id: string
  created_at: string
}

interface Notification {
  id: number
  title: string
  status: 'lost' | 'found'
  created_at: string
  read: boolean
}

export function useNotifications(currentUserRef: Ref<any>, isCurrentUserAdminRef: Ref<boolean>) {
  const toast = useToast()
  let itemSubscription: any = null
  const notifications = ref<Notification[]>([])

  // Check if a user is admin
  const checkIfUserIsAdmin = async (userId: string): Promise<boolean> => {
    try {
      const authStore = useAuthUserStore()
      const { users, error } = await authStore.getAllUsers()

      if (error) {
        console.error('Error fetching users for admin check:', error)
        return false
      }

      const userData = users?.find(u => u.id === userId)
      const roleId = userData?.raw_user_meta_data?.role ||
                     userData?.raw_app_meta_data?.role

      return roleId === 1
    } catch (error) {
      console.error('Error checking admin status:', error)
      return false
    }
  }

  // Setup real-time subscription for new items
  const setupItemNotifications = async () => {
    // Only setup notifications for non-admin users
    if (!currentUserRef.value || isCurrentUserAdminRef.value) {
      console.log('Skipping notification setup - user is admin or not logged in')
      return
    }

    // Clean up existing subscription first
    if (itemSubscription) {
      itemSubscription.unsubscribe()
    }

    console.log('Setting up item notifications for user:', currentUserRef.value.id)

    try {
      // Create the subscription
      itemSubscription = supabase
        .channel('item-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'items'
          },
          async (payload) => {
            console.log('Received new item notification:', payload)

            try {
              const newItem = payload.new as Item

              // Check if the item was posted by an admin
              const isAdminPost = await checkIfUserIsAdmin(newItem.user_id)
              console.log(`Item ${newItem.id} posted by admin:`, isAdminPost)

              if (isAdminPost) {
                // Show notification to user
                const statusText = newItem.status === 'lost' ? 'Lost Item' : 'Found Item'
                const statusIcon = newItem.status === 'lost' ? '🔴' : '🟢'

                toast.info(
                  `${statusIcon} New ${statusText}: ${newItem.title}`,
                  {
                    timeout: 8000,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    position: POSITION.TOP_RIGHT,
                  }
                )

                // Add to notifications array
                notifications.value.unshift({
                  id: newItem.id,
                  title: newItem.title,
                  status: newItem.status,
                  created_at: newItem.created_at,
                  read: false
                })

                // Keep only last 20 notifications
                if (notifications.value.length > 20) {
                  notifications.value = notifications.value.slice(0, 20)
                }

                console.log('Added notification for item:', newItem.title)
              }
            } catch (error) {
              console.error('Error processing notification payload:', error)
            }
          }
        )
        .subscribe(async (status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('Successfully subscribed to item notifications')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Channel subscription error:', err)
            // Try to resubscribe after a delay
            setTimeout(() => {
              console.log('Attempting to resubscribe to notifications...')
              setupItemNotifications()
            }, 5000)
          } else if (status === 'TIMED_OUT') {
            console.error('Channel subscription timed out')
          } else if (status === 'CLOSED') {
            console.log('Channel subscription closed')
          }
        })

    } catch (error) {
      console.error('Error setting up item notifications:', error)
    }
  }

  // Cleanup subscription
  const cleanup = () => {
    if (itemSubscription) {
      console.log('Cleaning up item notification subscription')
      itemSubscription.unsubscribe()
      itemSubscription = null
    }
  }

  // Mark notification as read
  const markAsRead = (notificationId: number) => {
    const notification = notifications.value.find(n => n.id === notificationId)
    if (notification && !notification.read) {
      notification.read = true
      console.log('Marked notification as read:', notificationId)
    }
  }

  // Clear all notifications
  const clearNotifications = () => {
    notifications.value = []
    console.log('Cleared all notifications')
  }

  // Test connection function
  const testConnection = async () => {
    try {
      const { data, error } = await supabase.from('items').select('count').limit(1)
      if (error) {
        console.error('Connection test failed:', error)
        return false
      }
      console.log('Connection test successful')
      return true
    } catch (error) {
      console.error('Connection test error:', error)
      return false
    }
  }

  onUnmounted(() => {
    cleanup()
  })

  return {
    notifications,
    setupItemNotifications,
    markAsRead,
    clearNotifications,
    cleanup,
    testConnection
  }
}
