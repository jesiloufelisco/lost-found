// stores/systemStats.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthUserStore } from '@/stores/authUser'

interface SystemStats {
  totalUsers: number
  totalItems: number
  activeConversations: number
  totalMessages: number
}

export const useSystemStatsStore = defineStore('systemStats', () => {
  // State
  const stats = ref<SystemStats>({
    totalUsers: 0,
    totalItems: 0,
    activeConversations: 0,
    totalMessages: 0
  })

  const loading = ref(false)
  const error = ref<string | null>(null)

  // Actions
  const fetchSystemStats = async () => {
    loading.value = true
    error.value = null

    try {
      const authStore = useAuthUserStore()

      // Fetch total users from auth
      const { users, error: usersError } = await authStore.getAllUsers()
      
      if (!usersError && users) {
        stats.value.totalUsers = users.length
      }

      // Fetch total items (lost & found)
      const { count: itemsCount } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })

      stats.value.totalItems = itemsCount || 0

      // Fetch total active conversations
      const { count: conversationsCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })

      stats.value.activeConversations = conversationsCount || 0

      // Fetch total messages exchanged
      const { count: messagesCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })

      stats.value.totalMessages = messagesCount || 0

    } catch (err) {
      console.error('Error fetching system stats:', err)
      error.value = err instanceof Error ? err.message : 'Failed to fetch system stats'
    } finally {
      loading.value = false
    }
  }

  // Optional: Fetch individual stat methods for granular control
  const fetchUsersCount = async () => {
    try {
      const authStore = useAuthUserStore()
      const { users, error: usersError } = await authStore.getAllUsers()
      
      if (!usersError && users) {
        stats.value.totalUsers = users.length
      }
    } catch (err) {
      console.error('Error fetching users count:', err)
    }
  }

  const fetchItemsCount = async () => {
    try {
      const { count: itemsCount } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })

      stats.value.totalItems = itemsCount || 0
    } catch (err) {
      console.error('Error fetching items count:', err)
    }
  }

  const fetchConversationsCount = async () => {
    try {
      const { count: conversationsCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })

      stats.value.activeConversations = conversationsCount || 0
    } catch (err) {
      console.error('Error fetching conversations count:', err)
    }
  }

  const fetchMessagesCount = async () => {
    try {
      const { count: messagesCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })

      stats.value.totalMessages = messagesCount || 0
    } catch (err) {
      console.error('Error fetching messages count:', err)
    }
  }

  // Reset stats
  const resetStats = () => {
    stats.value = {
      totalUsers: 0,
      totalItems: 0,
      activeConversations: 0,
      totalMessages: 0
    }
    error.value = null
  }

  return {
    // State
    stats,
    loading,
    error,
    
    // Actions
    fetchSystemStats,
    fetchUsersCount,
    fetchItemsCount,
    fetchConversationsCount,
    fetchMessagesCount,
    resetStats
  }
})