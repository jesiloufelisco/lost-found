import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getTotalUnreadMessageCount } from '@/stores/messages'

export const useSidebarStore = defineStore('sidebar', () => {
  // State
  const totalUnreadMessages = ref(0)
  const isLoading = ref(false)

  // Getters
  const hasUnreadMessages = computed(() => totalUnreadMessages.value > 0)

  // Actions
  const updateUnreadMessageCount = async (currentUserId: string) => {
    if (!currentUserId) return

    try {
      isLoading.value = true
      const count = await getTotalUnreadMessageCount(currentUserId)
      totalUnreadMessages.value = count
      console.log('Updated sidebar unread message count:', count)
    } catch (error) {
      console.error('Error updating sidebar unread message count:', error)
    } finally {
      isLoading.value = false
    }
  }

  const resetUnreadCount = () => {
    totalUnreadMessages.value = 0
  }

  const incrementUnreadCount = () => {
    totalUnreadMessages.value++
  }

  const decrementUnreadCount = (amount = 1) => {
    totalUnreadMessages.value = Math.max(0, totalUnreadMessages.value - amount)
  }

  return {
    // State
    totalUnreadMessages,
    isLoading,
    // Getters
    hasUnreadMessages,
    // Actions
    updateUnreadMessageCount,
    resetUnreadCount,
    incrementUnreadCount,
    decrementUnreadCount
  }
})
