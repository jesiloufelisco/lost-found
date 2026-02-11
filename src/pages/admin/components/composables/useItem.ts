import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthUserStore } from '@/stores/authUser'
import { useToast } from 'vue-toastification'

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

export function useItems(isCurrentUserAdmin: any, currentUser: any) {
  const toast = useToast()
  const authStore = useAuthUserStore()
  const items = ref<Item[]>([])
  const itemsLoading = ref(false)

  /**
   * Fetch all items from database with user email information (no role-based filtering)
   */
  const fetchItems = async () => {
    itemsLoading.value = true
    try {
      // Fetch all items without any role-based filtering
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching items:', error)
        toast.error('Failed to load items')
        return
      }

      // Fetch user emails for all items using authUser store
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(item => item.user_id))]

        // Use authUser store to get all users
        const { users, error: usersError } = await authStore.getAllUsers()

        if (usersError) {
          console.warn('Could not fetch user emails:', usersError)
          // Still show items even if we can't get user emails
          items.value = data || []
          return
        }

        // Create a map of user_id to email
        const userEmailMap = new Map()
        users?.forEach(user => {
          userEmailMap.set(user.id, user.email)
        })

        // Add user_email to each item
        const itemsWithEmails = data.map(item => ({
          ...item,
          user_email: userEmailMap.get(item.user_id) || 'Email not found'
        }))

        items.value = itemsWithEmails
      } else {
        items.value = data || []
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('An unexpected error occurred while loading items')
    } finally {
      itemsLoading.value = false
    }
  }

  return {
    items,
    itemsLoading,
    fetchItems,
  }
}
