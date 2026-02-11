/**
 * Utility functions for the application
 */

import { computed, ref, watch, type Ref } from 'vue';

// --- Interface for items (assuming ActivityItem structure) ---
export interface ActivityItem {
  id: string;
  type: "lost" | "found" | "resolved" | "claimed";
  title: string;
  user: string;
  timestamp: string; // Use 'timestamp' to match existing ActivityItem
  status: string;
  created_at: string; // Add 'created_at' as used in the new logic
}

// ----------------------------------------------------------------------------
// Existing Utility Functions
// ----------------------------------------------------------------------------

/**
 * Generates initials from an email address for avatar display
 * @param email - The email address to extract initials from
 * @returns A string of 1-2 uppercase letters representing the user's initials
 */
export function getEmailInitials(email: string | null | undefined): string {
  if (!email) return 'U'; // Default to 'U' for User if no email

  // Extract the local part (before @) from email
  const localPart = email.split('@')[0];

  // Split by common separators (dots, underscores, hyphens, numbers)
  const parts = localPart.split(/[\._\-\d]+/).filter(part => part.length > 0);

  if (parts.length >= 2) {
    // Take first letter of first two parts
    return (parts[0][0] + parts[1][0]).toUpperCase();
  } else if (parts.length === 1 && parts[0].length >= 2) {
    // Take first two letters of single part
    return (parts[0][0] + parts[0][1]).toUpperCase();
  } else if (parts.length === 1 && parts[0].length === 1) {
    // Single letter part
    return parts[0][0].toUpperCase();
  }

  // Fallback: take first letter of email
  return email[0].toUpperCase();
}

/**
 * Generates a display name from user data
 * @param userData - User data object containing name/email information
 * @returns A formatted display name
 */
export function getUserDisplayName(userData: {
  user_metadata?: { full_name?: string };
  email?: string
} | null): string {
  if (!userData) return 'User';

  const fullName = userData.user_metadata?.full_name;
  if (fullName) return fullName;

  if (userData.email) {
    // Extract name from email (part before @)
    const emailLocal = userData.email.split('@')[0];
    // Replace dots/underscores with spaces and capitalize
    return emailLocal.replace(/[\._]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return 'User';
}

/**
 * Formats a date string into a human-readable format
 * @param dateString - The date string to format
 * @returns A formatted date string in 'MMM d, yyyy, h:mm AM/PM' format
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ============================================================================
// Activity-related utilities
// ============================================================================

/**
 * Get the Vuetify color for an activity type
 * @param type - The activity type
 * @returns A Vuetify color name
 */
export function getActivityColor(type: string): string {
  switch (type) {
    case "lost":
      return "error";
    case "found":
      return "success";
    case "resolved":
    case "claimed":
      return "info";
    default:
      return "grey";
  }
}

/**
 * Get the Material Design icon for an activity type
 * @param type - The activity type
 * @returns A Material Design icon name
 */
export function getActivityIcon(type: string): string {
  switch (type) {
    case "lost":
      return "mdi-alert-circle";
    case "found":
      return "mdi-check-circle";
    case "resolved":
    case "claimed":
      return "mdi-account-check";
    default:
      return "mdi-circle";
  }
}

/**
 * Format a timestamp into a human-readable relative time
 * @param timestamp - The timestamp string to format
 * @returns A formatted relative time string (e.g., "5 minutes ago", "2 days ago")
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

/**
 * Filter activities by age and limit the number of items
 * @param activities - Array of activity items to filter
 * @param maxItems - Maximum number of items to return (default: 10)
 * @param maxDays - Maximum age of activities in days (default: 7)
 * @returns Filtered and limited array of activities
 */
export function filterRecentActivities(
  activities: ActivityItem[],
  maxItems: number = 10,
  maxDays: number = 7
): ActivityItem[] {
  const now = new Date();
  const maxAge = maxDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds

  return activities
    .filter(activity => {
      const activityDate = new Date(activity.timestamp);
      const age = now.getTime() - activityDate.getTime();
      return age <= maxAge; // Only include items within the time window
    })
    .slice(0, maxItems); // Limit to max number of items
}

// ============================================================================
// Filtering, Sorting, and Pagination Composable
// ============================================================================

// Type for the sort direction
type SortBy = 'newest' | 'oldest';

/**
 * Composable for handling filtering, sorting, and pagination of a list of items.
 *
 * @param items - A reactive reference to the array of items.
 * @returns An object containing reactive state and computed properties.
 */
export function useFilterSortPagination<T extends { created_at: string; title?: string; description?: string; location?: string; user?: any; status?: string; claimed_by?: string | null }>(
  items: Ref<T[]>,
  initialItemsPerPage: number = 10
) {
  // --- Reactive State ---
  const selectedMonth = ref('all');
  const selectedDay = ref('all');
  const sortBy = ref<SortBy>('newest');
  const page = ref(1);
  const itemsPerPage = ref(initialItemsPerPage);
  const searchQuery = ref('');
  const statusFilter = ref('active'); // Default to showing only lost/found items (not claimed)

  // --- Computed properties for filtering and sorting ---
  const availableMonths = computed(() => {
    const months = new Set<string>()

    // Always include current month
    const currentDate = new Date()
    const currentMonthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
    months.add(currentMonthYear)

    // Add months from existing items
    items.value.forEach(item => {
      // Ensure the property is correct, assuming T extends the ActivityItem's date structure
      const date = new Date(item.created_at)
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      months.add(monthYear)
    })
    return Array.from(months).sort((a, b) => b.localeCompare(a))
  })

  const availableDays = computed(() => {
    if (selectedMonth.value === 'all') return []

    const days = new Set<string>()
    const currentDate = new Date()
    const currentMonthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`

    // If current month is selected, always include today
    if (selectedMonth.value === currentMonthYear) {
      const today = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
      days.add(today)
    }

    // Add days from existing items
    items.value.forEach(item => {
      const date = new Date(item.created_at)
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (monthYear === selectedMonth.value) {
        const fullDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        days.add(fullDate)
      }
    })
    return Array.from(days).sort((a, b) => b.localeCompare(a))
  })

  const filteredAndSortedItems = computed(() => {
    let filtered = [...items.value]

    // Filter by status
    if (statusFilter.value === 'active') {
      // Show only lost/found items (not claimed)
      filtered = filtered.filter(item => !item.claimed_by)
    } else if (statusFilter.value === 'claimed') {
      // Show only claimed items
      filtered = filtered.filter(item => item.claimed_by)
    }
    // If statusFilter is 'all', don't filter by status

    // Filter by search query
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase().trim()
      filtered = filtered.filter(item => {
        // Search in title
        if (item.title && item.title.toLowerCase().includes(query)) {
          return true
        }

        // Search in description if available
        if (item.description && item.description.toLowerCase().includes(query)) {
          return true
        }

        // Search in location if available
        if (item.location && item.location.toLowerCase().includes(query)) {
          return true
        }

        // Search in user information if available
        if (item.user) {
          const userStr = typeof item.user === 'string' ? item.user :
                          item.user.email || item.user.name || ''
          if (userStr.toLowerCase().includes(query)) {
            return true
          }
        }

        return false
      })
    }

    // Filter by month
    if (selectedMonth.value !== 'all') {
      filtered = filtered.filter(item => {
        const date = new Date(item.created_at)
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        return monthYear === selectedMonth.value
      })
    }

    // Filter by day
    if (selectedDay.value !== 'all') {
      filtered = filtered.filter(item => {
        const date = new Date(item.created_at)
        const fullDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        return fullDate === selectedDay.value
      })
    }

    // Sort items
    filtered.sort((a, b) => {
      // Assuming 'created_at' is the timestamp property
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return sortBy.value === 'newest' ? dateB - dateA : dateA - dateB
    })

    return filtered
  })

  const paginatedItems = computed(() => {
    const start = (page.value - 1) * itemsPerPage.value
    const end = start + itemsPerPage.value
    return filteredAndSortedItems.value.slice(start, end)
  })

  const totalPages = computed(() => {
    return Math.ceil(filteredAndSortedItems.value.length / itemsPerPage.value)
  })

  // --- Formatting Functions ---
  const formatMonthLabel = (monthValue: string) => {
    const [year, month] = monthValue.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const formatDayLabel = (dayValue: string) => {
    const date = new Date(dayValue)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // --- Watchers for State Reset ---
  // Reset pagination when filters change
  watch([selectedMonth, selectedDay, sortBy, itemsPerPage, searchQuery, statusFilter], () => {
    page.value = 1
  })

  // Reset day filter when month changes
  watch(selectedMonth, () => {
    selectedDay.value = 'all'
  })

  // Return reactive state and computed properties
  return {
    selectedMonth,
    selectedDay,
    sortBy,
    page,
    itemsPerPage,
    searchQuery,
    statusFilter,
    availableMonths,
    availableDays,
    filteredAndSortedItems,
    paginatedItems,
    totalPages,
    formatMonthLabel,
    formatDayLabel,
  }
}

/**
 * Get the Material Design icon for a status
 * @param status - The status type ('lost' or 'found')
 * @returns A Material Design icon name
 */
export function getStatusIcon(status: string): string {
  return status === 'lost' ? 'mdi-alert-circle' : 'mdi-check-circle';
}


/**
 * Get the Vuetify color for a status
 * @param status - The status type ('lost' or 'found')
 * @returns A Vuetify color name
 */
export function getStatusColor(status: string): string {
  return status === 'lost' ? 'error' : 'success';
}

/**
 * Get the Vuetify color for an item's status (considering claimed state)
 * @param item - The item object with status and claimed_by properties
 * @returns A Vuetify color name
 */
export function getItemStatusColor(item: { status: string; claimed_by?: string | null }): string {
  if (item.claimed_by) return "success";
  return item.status === "lost" ? "error" : "info";
}

/**
 * Get the display text for an item's status (considering claimed state)
 * @param item - The item object with status and claimed_by properties
 * @returns A status text string
 */
export function getItemStatusText(item: { status: string; claimed_by?: string | null }): string {
  if (item.claimed_by) return "Claimed";
  return item.status === "lost" ? "Lost" : "Found";
}
