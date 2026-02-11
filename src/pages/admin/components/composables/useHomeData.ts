
import { ref, onMounted, computed, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { supabase } from '@/lib/supabase'
import { useAuthUserStore } from '@/stores/authUser'
import { useNotifications } from '@/pages/student/components/composables/useNotification'

// Interface for type safety
export interface Item {
  id: number
  title: string
  description: string
  status: 'lost' | 'found'
  user_id: string
  claimed_by: string
  created_at: string
}

export default function useHomeData() {
  const toast = useToast()

  // --- Global State ---
  const items = ref<Item[]>([])
  const itemsLoading = ref(false)
  const currentUser = ref<any>(null)
  const isCurrentUserAdmin = ref(false)
  const showNotificationBell = ref(false)
  const showNotificationDialog = ref(false)

  // --- Filtering, Sorting, and Pagination State ---
  const page = ref(1)
  const itemsPerPage = ref(8)
  const sortBy = ref<'newest' | 'oldest'>('newest')
  const filterByMonth = ref<string>('all')
  const searchQuery = ref('')

  // --- Initialize Notifications (For setup purposes) ---
  // NOTE: This setup is here because it depends on currentUser and isCurrentUserAdmin
  // The actual notification data and functions will be used in Home.vue
  const { setupItemNotifications, cleanup } = useNotifications(currentUser, isCurrentUserAdmin)

  // --- Utility Functions ---

  /**
   * Checks if the current authenticated user has the admin role (role_id === 1).
   * @param user The current Supabase user object.
   */
  const checkIfUserIsAdmin = async (user: any): Promise<boolean> => {
    if (!user) return false

    try {
      const authStore = useAuthUserStore()
      // Directly check for roles.TS data if possible, or use the existing logic
      // Assuming getAllUsers is the necessary method as per the original code
      const { users, error } = await authStore.getAllUsers()

      if (error) return false

      const currentUserData = users?.find(u => u.id === user.id)
      const roleId = currentUserData?.raw_user_meta_data?.role ||
                     currentUserData?.raw_app_meta_data?.role

      return roleId === 1
    } catch (error) {
      console.error('Error checking admin status:', error)
      return false
    }
  }

  /**
   * Fetches the current user and determines admin status.
   */
  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    currentUser.value = user

    if (user) {
      isCurrentUserAdmin.value = await checkIfUserIsAdmin(user)
      showNotificationBell.value = !isCurrentUserAdmin.value

      if (!isCurrentUserAdmin.value) {
        await setupItemNotifications()
      }
    }
  }

  /**
   * Fetches items from the database, filtering by user role.
   */
  const fetchItems = async () => {
    itemsLoading.value = true
    try {
      let query = supabase.from('items').select('*')

      if (!isCurrentUserAdmin.value) {
        // Fetch items posted by admins for regular users
        const authStore = useAuthUserStore()
        const { users, error: usersError } = await authStore.getAllUsers()

        if (usersError) {
          console.error('Error fetching users:', usersError)
          toast.error('Failed to load admin users')
          items.value = []
          return
        }

        const adminUsers = users?.filter(user =>
          user.raw_user_meta_data?.role === 1 || user.raw_app_meta_data?.role === 1
        ) || []

        if (adminUsers.length === 0) {
          items.value = []
          return
        }

        const adminUserIds = adminUsers.map(admin => admin.id)
        query = query.in('user_id', adminUserIds)
      } else {
        // Fetch only items posted by the current admin user
        query = query.eq('user_id', currentUser.value.id)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching items:', error)
        toast.error('Failed to load items')
        return
      }

      items.value = data || []
    } catch (error) {
      console.error('Error:', error)
      toast.error('An unexpected error occurred while loading items')
    } finally {
      itemsLoading.value = false
    }
  }

  /**
   * Helper to convert monthYear string to a readable format.
   */
  const getMonthName = (monthYear: string) => {
    const [year, month] = monthYear.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  /**
   * Resets the filters (month and search query).
   */
  const clearAllFilters = () => {
      filterByMonth.value = 'all'
      searchQuery.value = ''
      page.value = 1
  }

  // --- Computed Properties for Filtering, Sorting, and Pagination ---

  /**
   * Calculates the unique month/year combinations available in the items.
   */
  const availableMonths = computed(() => {
    const months = new Set<string>()
    items.value.forEach(item => {
      const date = new Date(item.created_at)
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      months.add(monthYear)
    })
    return Array.from(months).sort().reverse()
  })

  /**
   * Applies search, month filtering, and sorting to the items.
   */
  const filteredItems = computed(() => {
    let filtered = [...items.value]

    // 1. Filter by search query
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase()
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
      )
    }

    // 2. Filter by month
    if (filterByMonth.value !== 'all') {
      filtered = filtered.filter(item => {
        const date = new Date(item.created_at)
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        return monthYear === filterByMonth.value
      })
    }

    // 3. Sort
    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return sortBy.value === 'newest' ? dateB - dateA : dateA - dateB
    })

    return filtered
  })

  /**
   * Applies pagination to the filtered and sorted list.
   */
  const paginatedItems = computed(() => {
    const start = (page.value - 1) * itemsPerPage.value
    const end = start + itemsPerPage.value
    return filteredItems.value.slice(start, end)
  })

  /**
   * Calculates the total number of pages required.
   */
  const totalPages = computed(() => {
    return Math.ceil(filteredItems.value.length / itemsPerPage.value)
  })

  /**
   * Dynamic title for the page header.
   */
  const pageTitle = computed(() => isCurrentUserAdmin.value ? 'Manage Lost & Found Items' : 'Lost & Found')

  /**
   * Dynamic subtitle for the page header.
   */
  const pageSubtitle = computed(() => isCurrentUserAdmin.value ? 'Manage your posted items and view conversations' : 'Find your lost items or help others find theirs')

  // --- Watchers and Lifecycle ---

  // Reset page when filters change
  watch([filterByMonth, sortBy, searchQuery], () => {
    page.value = 1
  })

  // Re-fetch items if user or admin status changes (though this is only done once on mount)
  watch([currentUser, isCurrentUserAdmin], async ([user, isAdmin]) => {
    if (user) {
        // Re-run setupItemNotifications if user changes and they are not an admin
        if (!isAdmin) {
             await setupItemNotifications()
        }
        await fetchItems()
    }
  }, { immediate: false })

  onMounted(async () => {
    // Initial fetch of user and data on component mount
    await getCurrentUser()
    // Initial fetchItems is handled by the watch on currentUser/isCurrentUserAdmin
  })

  // Expose all necessary state and methods
  return {
    // State
    itemsLoading,
    isCurrentUserAdmin,
    currentUser,
    showNotificationBell,
    showNotificationDialog, // Still needed in Home.vue for the dialog v-model

    // Data
    filteredItems,
    paginatedItems,
    availableMonths,

    // Filtering/Sorting/Pagination
    page,
    itemsPerPage,
    sortBy,
    filterByMonth,
    searchQuery,
    totalPages,
    getMonthName,

    // Actions
    fetchItems,
    clearAllFilters,

    // Computed Properties for UI
    pageTitle,
    pageSubtitle,
  }
}
