//Home.vue
<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from "vue";
import InnerLayoutWrapper from "@/layouts/InnerLayoutWrapper.vue";
import AdminItemCard from "@/pages/admin/components/AdminCard.vue";
import UserItemCard from "@/pages/student/components/ItemCard.vue";
import UserChatDialog from "@/pages/student/components/userChatDialog.vue";
import AdminChatDialog from "@/pages/admin/components/AdminChatDialog.vue";
import NotificationDialog from "@/pages/student/components/NotifDialog.vue";
import FloatingAdminChat from "@/pages/student/components/FloatingAdminChat.vue";
import ItemFilters from "@/components/common/ItemFilters.vue";
import DirectAdminMessageCard from "@/components/common/DirectAdminMessageCard.vue";

// Composables
import { useAuth } from "@/pages/admin/components/composables/useAuth";
import { useItems } from "@/pages/admin/components/composables/useItem";
import { usePageConfig } from "@/pages/admin/components/composables/usePageConfig";
import { useUserChat } from "@/pages/student/components/composables/useUserChat";
import { useAdminChat } from "@/pages/admin/components/composables/useAdminChat";
import { useAdminItemActions } from "@/pages/admin/components/composables/useAdminItems";
import { useNotifications } from "@/pages/student/components/composables/useNotification";
import { useNotifications as useGlobalNotifications } from "@/composables/useNotifications";
import { useAdminSupport } from "@/pages/student/components/composables/useAdminSupport";
import { useFilterSortPagination } from "@/utils/helpers";
import { useAuthUserStore } from "@/stores/authUser";

import "@/styles/home.css";

// Auth store and composable
const authStore = useAuthUserStore();
const { currentUser, getCurrentUser } = useAuth();

// Computed property to check if current user is admin (role ID 1)
const isCurrentUserAdmin = computed(() => authStore.userRoleId === 1);

// Items composable
const { items, itemsLoading, fetchItems } = useItems(
  isCurrentUserAdmin,
  currentUser
);

// Page config composable
const { pageTitle, pageSubtitle, emptyStateConfig } =
  usePageConfig(isCurrentUserAdmin);

// Filter, Sort, and Pagination
const {
  page,
  itemsPerPage,
  sortBy,
  selectedMonth,
  selectedDay,
  searchQuery,
  statusFilter,
  availableMonths,
  availableDays,
  filteredAndSortedItems,
  paginatedItems,
  totalPages,
  formatMonthLabel,
  formatDayLabel,
} = useFilterSortPagination(items, 12);

// User chat composable
const {
  showChatDialog,
  selectedItem,
  messages,
  messagesLoading,
  sendingMessage,
  handleContact,
  sendMessage,
  closeChatDialog,
} = useUserChat(currentUser);

// Admin chat composable
const {
  showAdminConversationsDialog,
  selectedItemForConversations,
  adminConversations,
  selectedAdminConversation,
  adminMessages,
  newAdminMessage,
  loadingAdminConversations,
  loadingAdminMessages,
  sendingAdminMessage,
  handleOpenConversations,
  selectAdminConversation,
  sendAdminMessage,
  closeAdminConversationsDialog,
} = useAdminChat(currentUser);

// Admin actions composable
const { updatingItems, markAsClaimed } = useAdminItemActions(fetchItems);

// Notifications composable (local item notifications)
const showNotificationBell = ref(false);
const showNotificationDialog = ref(false);

const {
  notifications,
  setupItemNotifications,
  markAsRead,
  clearNotifications,
  cleanup,
} = useNotifications(currentUser, isCurrentUserAdmin);

// Global notifications composable (for admin broadcasts)
const {
  unreadCount: globalUnreadCount,
  loadMyNotifications,
  markAllMyNotificationsAsRead,
  userNotificationsStore,
  setupRealtimeNotifications,
  teardownRealtimeNotifications
} = useGlobalNotifications();

// Combined unread count from both local and global notifications
const unreadCount = computed(() => {
  const localUnread = notifications.value.filter((n) => !n.read).length;
  const globalUnread = globalUnreadCount.value || 0;
  return localUnread + globalUnread;
});

// Transform global notifications to match expected format
const transformedGlobalNotifications = computed(() => {
  return userNotificationsStore.userNotifications
    .filter(n => n.id != null) // Filter out any notifications without valid IDs
    .map(n => ({
      ...n,
      type: 'global' as const
    }));
});

// Transform local notifications to match expected format
const transformedLocalNotifications = computed(() => {
  return notifications.value.map(n => ({
    ...n,
    type: 'local' as const
  }));
});

const toggleNotifications = () => {
  showNotificationDialog.value = true;
};

const handleMarkAsRead = (notificationId: number) => {
  markAsRead(notificationId);
};

const handleClearAllNotifications = () => {
  clearNotifications();
  markAllMyNotificationsAsRead();
};

// Clear all filters method
const clearAllFilters = () => {
  selectedMonth.value = 'all';
  selectedDay.value = 'all';
  searchQuery.value = '';
  statusFilter.value = 'active'; // Reset to default (lost items only)
};

// Student Admin Support Chat
const {
  showSupportChat,
  supportMessages,
  messagesLoading: supportMessagesLoading,
  sendingMessage: sendingSupportMessage,
  initializingChat,
  openSupportChat,
  sendSupportMessage,
  closeSupportChat,
} = useAdminSupport(currentUser);

// Watch for user changes to setup notifications and show support button
watch(
  [currentUser, isCurrentUserAdmin],
  async ([user, isAdmin]) => {
    if (user && !isAdmin) {
      await setupItemNotifications();
      // Load global notifications for students
      await loadMyNotifications();
      // Setup real-time notifications
      setupRealtimeNotifications();
      showNotificationBell.value = true;
    } else {
      // Cleanup real-time notifications when user is admin or not authenticated
      teardownRealtimeNotifications();
      showNotificationBell.value = false;
    }
  },
  { immediate: true }
);

onMounted(async () => {
  await getCurrentUser();
  await fetchItems();
});

// Cleanup on component unmount
onUnmounted(() => {
  teardownRealtimeNotifications();
  cleanup(); // Cleanup local notifications
});
</script>

<template>
  <InnerLayoutWrapper>
    <template #content>
      <v-container fluid class="pa-6">

        <v-row class="mb-6">
          <v-col cols="12">
            <div class="pa-6 pa-sm-8 pa-md-12 position-relative">
              <!-- Compact Header Content -->
              <div class="text-center mb-3 mb-md-4">
                <h1 class="text-h4 text-sm-h3 font-weight-bold text-green-darken-4 mb-1">
                  {{ pageTitle }}
                </h1>
                <p class="text-body-1 text-sm-h6 text-grey-darken-1 mb-0">
                  {{ pageSubtitle }}
                </p>
              </div>

              <!-- Centered Notification Bell for Students -->
              <div v-if="showNotificationBell" class="text-center mb-2">
                <v-btn
                  icon
                  @click="toggleNotifications"
                  :color="unreadCount > 0 ? 'primary' : 'grey-lighten-1'"
                  :size="$vuetify.display.xs ? 'default' : 'large'"
                  elevation="2"
                  class="notification-bell-btn"
                >
                  <v-badge
                    :content="unreadCount"
                    :model-value="unreadCount > 0"
                    color="error"
                    overlap
                  >
                    <v-icon :size="$vuetify.display.xs ? 'default' : 'large'">mdi-bell</v-icon>
                  </v-badge>
                </v-btn>
                <div class="text-caption text-grey-darken-1 mt-1">
                  Notifications
                </div>
              </div>

              <!-- Welcome Admin Text -->
              <div v-else-if="isCurrentUserAdmin" class="text-center mb-2">
                <div class="d-flex align-center justify-center mb-2">
                  <v-icon color="primary" size="large" class="me-2">mdi-shield-crown</v-icon>
                  <h2 class="text-h5 font-weight-bold text-primary mb-0">Welcome Admin</h2>
                </div>
                <p class="text-body-2 text-grey-darken-1 mb-0">
                  Manage lost & found items and oversee the system
                </p>
              </div>
            </div>
          </v-col>
        </v-row>
 <!-- Direct Admin Message Card -->
        <v-row class="mb-4">
          <v-col cols="12">
            <DirectAdminMessageCard
              :current-user="currentUser"
              :is-current-user-admin="isCurrentUserAdmin"
            />
          </v-col>
        </v-row>
        <v-row class="mb-4">
          <v-col cols="12">
            <ItemFilters
              v-model:search-query="searchQuery"
              v-model:sort-by="sortBy"
              v-model:selected-month="selectedMonth"
              v-model:selected-day="selectedDay"
              v-model:items-per-page="itemsPerPage"
              v-model:status-filter="statusFilter"
              :available-months="availableMonths"
              :available-days="availableDays"
              :format-month-label="formatMonthLabel"
              :format-day-label="formatDayLabel"
            />
          </v-col>
        </v-row>



        <v-row>
          <v-col cols="12">
            <v-card elevation="2" class="pa-4">
              <v-card-title
                class="text-h5 font-weight-bold mb-4 d-flex align-center"
              >
                <v-icon class="me-2" color="primary"
                  >mdi-package-variant-closed</v-icon
                >
                {{ emptyStateConfig.sectionTitle }}
                <v-spacer />
                <v-chip
                  v-if="!itemsLoading"
                  color="info"
                  variant="tonal"
                  :size="$vuetify.display.xs ? 'x-small' : 'small'"
                >
                  <!-- Mobile view: shorter text -->
                  <span class="d-sm-none">
                    {{ filteredAndSortedItems.length }}/{{ items.length }}
                  </span>
                  <!-- Desktop view: full text -->
                  <span class="d-none d-sm-inline">
                    {{ filteredAndSortedItems.length }} of {{ items.length }} items
                  </span>
                </v-chip>
              </v-card-title>

              <div v-if="itemsLoading" class="text-center py-12">
                <v-progress-circular indeterminate color="primary" size="48" />
                <p class="text-body-1 mt-4">Loading items...</p>
              </div>

              <div
                v-else-if="filteredAndSortedItems.length === 0"
                class="text-center py-12"
              >
                <v-icon size="80" color="grey-lighten-1" class="mb-4">
                  mdi-package-variant-closed-remove
                </v-icon>
                <h3 class="text-h5 text-grey-darken-1 mb-2">
                  {{
                    items.length === 0
                      ? emptyStateConfig.noItemsTitle
                      : "No items match your filters"
                  }}
                </h3>
                <p class="text-body-1 text-grey-darken-2 mb-4">
                  {{
                    items.length === 0
                      ? emptyStateConfig.noItemsMessage
                      : "Try adjusting your search or filters to see more items."
                  }}
                </p>
                <v-btn
                  v-if="items.length === 0"
                  color="primary"
                  variant="outlined"
                  prepend-icon="mdi-refresh"
                  @click="fetchItems"
                >
                  Refresh
                </v-btn>
                <v-btn
                  v-else
                  color="primary"
                  variant="outlined"
                  prepend-icon="mdi-filter-remove"
                  @click="clearAllFilters"
                >
                  Clear Filters
                </v-btn>
              </div>

              <div v-else>
                <v-row class="items-grid">
                  <v-col
                    v-for="item in paginatedItems"
                    :key="item.id"
                    cols="12"
                    sm="6"
                    md="4"
                    lg="3"
                    xl="3"
                  >
                    <AdminItemCard
                      v-if="isCurrentUserAdmin"
                      :item="item"
                      :is-updating="updatingItems.has(item.id)"
                      @open-conversations="handleOpenConversations"
                      @mark-as-claimed="markAsClaimed"
                    />

                    <UserItemCard
                      v-else
                      :item="item"
                      :is-updating="false"
                      @contact="handleContact(item)"
                    />
                  </v-col>
                </v-row>

                <v-row v-if="totalPages > 1" class="mt-6">
                  <v-col cols="12">
                    <div
                      class="d-flex justify-center align-center flex-wrap gap-2"
                    >
                      <v-pagination
                        v-model="page"
                        :length="totalPages"
                        :total-visible="7"
                        rounded="circle"
                        color="primary"
                      />

                      <div class="text-caption text-grey-darken-1 ml-4">
                        Showing {{ (page - 1) * itemsPerPage + 1 }}-{{
                          Math.min(
                            page * itemsPerPage,
                            filteredAndSortedItems.length
                          )
                        }}
                        of {{ filteredAndSortedItems.length }}
                      </div>
                    </div>
                  </v-col>
                </v-row>
              </div>
            </v-card>
          </v-col>
        </v-row>

        <!-- Item-based Chat Dialogs -->
        <UserChatDialog
          v-model:show="showChatDialog"
          :item="selectedItem"
          :messages="messages"
          :messages-loading="messagesLoading"
          :sending-message="sendingMessage"
          @send-message="sendMessage"
        />

        <AdminChatDialog
          v-model:show="showAdminConversationsDialog"
          :item="selectedItemForConversations"
          :conversations="adminConversations"
          :messages="adminMessages"
          :selected-conversation="selectedAdminConversation"
          :loading-conversations="loadingAdminConversations"
          :loading-messages="loadingAdminMessages"
          :sending-message="sendingAdminMessage"
          @select-conversation="selectAdminConversation"
          @send-message="sendAdminMessage"
        />

        <NotificationDialog
          v-model="showNotificationDialog"
          :notifications="transformedLocalNotifications"
          :global-notifications="transformedGlobalNotifications"
          @mark-as-read="handleMarkAsRead"
          @mark-global-as-read="(id) => userNotificationsStore.markAsRead(id)"
          @clear-all="handleClearAllNotifications"
        />

        <!-- Student Admin Support Chat (Floating) -->
        <!-- <FloatingAdminChat
          v-if="!isCurrentUserAdmin && currentUser"
          v-model:show="showSupportChat"
          :messages="supportMessages"
          :messages-loading="supportMessagesLoading"
          :sending-message="sendingSupportMessage"
          :initializing-chat="initializingChat"
          @send-message="sendSupportMessage"
          @open-chat="openSupportChat"
        /> -->
      </v-container>
    </template>
  </InnerLayoutWrapper>
</template>

<style scoped>
.notification-bell-btn {
  animation: pulse 2s infinite;
}

.notification-bell-btn:hover {
  transform: scale(1.1);
  transition: transform 0.2s ease-in-out;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--v-theme-primary), 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(var(--v-theme-primary), 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(var(--v-theme-primary), 0);
  }
}
</style>
