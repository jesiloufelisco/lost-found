<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed, ref } from "vue";
import InnerLayoutWrapper from "@/layouts/InnerLayoutWrapper.vue";
import AdminSupportInbox from "@/pages/admin/components/AdminSupportInbox.vue";
import { supabase } from "@/lib/supabase";
import { loadItems as loadItemsFromStore, getUnreadMessageCountsForItems, updateUnreadCountForConversation as updateUnreadCountForConversationStore } from "@/stores/messages";
import { useSidebarStore } from "@/stores/sidebar";

// Composables
import { useAuth } from "@/pages/admin/components/composables/useAuth";
import { useAdminSupportInbox } from "@/pages/admin/components/composables/useAdminSupportInbox";

// Auth composable
const { currentUser, isCurrentUserAdmin, getCurrentUser } = useAuth();

// Sidebar store for updating badge
const sidebarStore = useSidebarStore();

// Items state
const items = ref<any[]>([]);
const loadingItems = ref(false);
const selectedItem = ref<any>(null);
const unreadMessageCounts = ref<Record<number, number>>({});

// Direct message state
const showDirectMessages = ref(false);
const directMessageUnreadCount = ref(0);
const selectedUser = ref<any>(null);

// View mode: 'items' | 'direct-messages' | 'user-messages'
const viewMode = ref<'items' | 'direct-messages' | 'user-messages'>('items');

// Real-time subscription
let messagesSubscription: any = null;

// New message variable
const newMessage = ref('');

// Computed property to get current user role
const currentUserRole = computed(() => {
  console.log("Current User:", currentUser.value?.app_metadata);
  return currentUser.value?.app_metadata?.role || currentUser.value?.user_metadata?.role || null;
});

// Computed property to filter conversations based on selected item or user
const filteredConversations = computed(() => {
  if (viewMode.value === 'direct-messages') {
    // Show direct message conversations (no item_id)
    return supportConversations.value.filter(conversation => {
      return conversation.item_id === null || conversation.item_id === undefined;
    });
  }

  if (viewMode.value === 'user-messages' && selectedUser.value) {
    // Show conversations for selected user
    return supportConversations.value.filter(conversation => {
      return (conversation.item_id === null || conversation.item_id === undefined) &&
             conversation.sender_id === selectedUser.value.id;
    });
  }

  if (!selectedItem.value) return [];

  // Filter conversations by selected item
  return supportConversations.value.filter(conversation => {
    return conversation.item_id === selectedItem.value.id;
  });
});

// Computed property for direct message conversations (no item associated)
const directMessageConversations = computed(() => {
  return supportConversations.value.filter(conversation => {
    return conversation.item_id === null || conversation.item_id === undefined;
  });
});

// Computed property to count conversations per item
const getItemConversationCount = (itemId: number) => {
  return supportConversations.value.filter(conv => conv.item_id === itemId).length;
};

// Get unread message count for an item
const getUnreadMessageCount = (itemId: number) => {
  return unreadMessageCounts.value[itemId] || 0;
};

// Get unread count for direct messages
const getDirectMessageUnreadCount = () => {
  return directMessageConversations.value.reduce((total, conv) => {
    return total + (conversationUnreadCounts.value[conv.id] || 0);
  }, 0);
};

// Computed property to filter items that have conversations
const itemsWithConversations = computed(() => {
  return items.value.filter(item => {
    return supportConversations.value.some(conv => conv.item_id === item.id);
  });
});

// Computed property to get unique users with direct messages
const usersWithDirectMessages = computed(() => {
  const userMap = new Map();

  directMessageConversations.value.forEach(conv => {
    if (conv.sender_profile || conv.sender_id) {
      const userId = conv.sender_id;
      const userProfile = conv.sender_profile;

      if (!userMap.has(userId)) {
        userMap.set(userId, {
          id: userId,
          full_name: userProfile?.full_name || 'Unknown User',
          email: userProfile?.email || 'No email',
          conversations: [],
          unread_count: 0,
          latest_message_date: conv.created_at
        });
      }

      const user = userMap.get(userId);
      user.conversations.push(conv);
      user.unread_count += conversationUnreadCounts.value[conv.id] || 0;

      // Update latest message date
      if (new Date(conv.created_at) > new Date(user.latest_message_date)) {
        user.latest_message_date = conv.created_at;
      }
    }
  });

  return Array.from(userMap.values()).sort((a, b) =>
    new Date(b.latest_message_date).getTime() - new Date(a.latest_message_date).getTime()
  );
});

// Admin Support Inbox composable
const {
  showInbox: showAdminSupportInbox,
  supportConversations,
  selectedConversation: selectedSupportConversation,
  messages: supportInboxMessages,
  loadingConversations: loadingSupportConversations,
  loadingMessages: loadingSupportMessages,
  sendingMessage: sendingSupportInboxMessage,
  unreadCounts: conversationUnreadCounts,
  isOtherUserTyping,
  otherUserTypingName,
  conversationTypingStatus, // For showing typing in conversation list
  // Pagination state
  currentPage,
  pageSize,
  totalCount,
  totalPages,
  // Functions
  openInbox,
  closeInbox,
  selectConversation: selectSupportConversation,
  sendMessageToStudent,
  loadSupportConversations,
  handleTyping,
  // Pagination functions
  goToPage,
  nextPage,
  previousPage,
  changePageSize,
} = useAdminSupportInbox(currentUser);

// Page title and description
const pageTitle = computed(() => "Support Inbox");
const pageDescription = computed(() => "Manage student support conversations and provide assistance");

// Load all items
const loadItems = async () => {
  loadingItems.value = true;
  try {
    items.value = await loadItemsFromStore();

    // Load unread message counts for all items
    const itemIds = items.value.map(item => item.id);
    if (itemIds.length > 0 && currentUser.value) {
      unreadMessageCounts.value = await getUnreadMessageCountsForItems(itemIds, currentUser.value.id);

      // Update sidebar store with fresh total unread count
      await sidebarStore.updateUnreadMessageCount(currentUser.value.id);
    }
  } catch (error) {
    console.error('Error loading items:', error);
  } finally {
    loadingItems.value = false;
  }
};

// Select an item to view its support conversations
const selectItem = async (item: any) => {
  selectedItem.value = item;
  viewMode.value = 'items';
  await loadSupportConversations(1);
};

// Show direct messages view (user grid)
const showDirectMessagesView = async () => {
  viewMode.value = 'direct-messages';
  selectedItem.value = null;
  selectedUser.value = null;
  selectedSupportConversation.value = null;
  await loadSupportConversations(1);
};

// Select a user to view their direct messages
const selectUser = async (user: any) => {
  selectedUser.value = user;
  viewMode.value = 'user-messages';
  selectedSupportConversation.value = null;
  await loadSupportConversations(1);
};

// Go back to items list
const backToItems = () => {
  selectedItem.value = null;
  selectedSupportConversation.value = null;
  viewMode.value = 'items';
};

// Go back to main view (from direct messages)
const backToMainView = () => {
  viewMode.value = 'items';
  selectedUser.value = null;
  selectedSupportConversation.value = null;
};

// Go back to users list (from specific user messages)
const backToUsers = () => {
  viewMode.value = 'direct-messages';
  selectedUser.value = null;
  selectedSupportConversation.value = null;
};

// Message sending handlers
const handleSendMessage = async () => {
  if (newMessage.value.trim()) {
    await sendMessageToStudent(newMessage.value);
    newMessage.value = '';
  }
};

// Update unread count for a conversation and its item
const updateUnreadCountForConversation = async (conversationId: string) => {
  try {
    if (!currentUser.value) return;

    // Find the conversation to get its item_id
    const conversation = supportConversations.value.find(conv => conv.id === conversationId);
    if (!conversation || !conversation.item_id) return;

    // Get unread count from store
    const count = await updateUnreadCountForConversationStore(conversationId, currentUser.value.id);

    // Update conversation unread count
    conversationUnreadCounts.value[conversationId] = count;

    // Recalculate item unread count
    const itemId = conversation.item_id;
    const itemConversations = supportConversations.value.filter(conv => conv.item_id === itemId);
    let totalUnread = 0;

    for (const conv of itemConversations) {
      totalUnread += conversationUnreadCounts.value[conv.id] || 0;
    }

    unreadMessageCounts.value[itemId] = totalUnread;
    console.log('Updated unread counts - Conversation:', conversationId, 'Count:', count, 'Item:', itemId, 'Total:', totalUnread);

    // Update sidebar store with fresh total unread count
    if (currentUser.value?.id) {
      await sidebarStore.updateUnreadMessageCount(currentUser.value.id);
    }
  } catch (error) {
    console.error('Error updating unread count:', error);
  }
};

// Setup real-time subscription for messages
const setupMessagesRealtimeSubscription = () => {
  console.log('Setting up real-time subscription for messages table');

  messagesSubscription = supabase
    .channel('messages-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      async (payload) => {
        console.log('New message inserted:', payload.new);
        const message = payload.new as any;

        // Update unread counts for the conversation
        await updateUnreadCountForConversation(message.conversation_id);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
      },
      async (payload) => {
        console.log('Message updated:', payload.new);
        const message = payload.new as any;

        // Update unread counts for the conversation (e.g., when isread changes)
        await updateUnreadCountForConversation(message.conversation_id);
      }
    )
    .subscribe((status) => {
      console.log('Messages real-time subscription status:', status);
    });
};

// Cleanup real-time subscription
const cleanupMessagesSubscription = () => {
  if (messagesSubscription) {
    supabase.removeChannel(messagesSubscription);
    messagesSubscription = null;
    console.log('Messages real-time subscription cleaned up');
  }
};

onMounted(async () => {
  await getCurrentUser();
  // Load items and conversations
  await loadItems();
  openInbox();

  // Setup real-time subscription for messages
  setupMessagesRealtimeSubscription();

  console.log('SupportInboxView mounted - broadcast subscriptions initialized');
});

onBeforeUnmount(() => {
  // Cleanup subscriptions when component unmounts
  closeInbox();
  cleanupMessagesSubscription();
  console.log('SupportInboxView unmounted - broadcast subscriptions cleaned up');
});
</script>

<template>
  <InnerLayoutWrapper>
    <template #content>
      <v-container fluid class="pa-6">
        <!-- Page Header -->
        <v-row class="mb-6">
          <v-col cols="12">
            <div class="text-center mb-4 mb-md-6">
              <h1 class="text-h2 text-sm-h1 font-weight-bold text-green-darken-4 mb-2">
                {{ pageTitle }}
              </h1>
              <p class="text-h6 text-sm-h5 text-grey-darken-1 mb-0">
                {{ pageDescription }}
              </p>
            </div>
          </v-col>
        </v-row>

        <!-- Support Inbox Content -->
        <v-row>
          <v-col cols="12">
            <!-- Show Items Grid and Direct Messages when no specific item is selected and not in direct messages view -->
            <div v-if="!selectedItem && viewMode === 'items'">
              <v-card elevation="2" class="pa-4 mb-4">
                <v-card-title class="text-h5 font-weight-bold mb-4 d-flex align-center">
                  <v-icon class="me-2" color="primary">mdi-package-variant</v-icon>
                  Items with Support Requests
                  <v-spacer />
                  <v-chip
                    v-if="!loadingItems"
                    color="info"
                    variant="tonal"
                    :size="$vuetify.display.xs ? 'x-small' : 'small'"
                  >
                    {{ itemsWithConversations.length }} {{ itemsWithConversations.length === 1 ? 'Item' : 'Items' }}
                  </v-chip>
                </v-card-title>

                <!-- Loading State -->
                <div v-if="loadingItems" class="text-center py-12">
                  <v-progress-circular indeterminate color="primary" size="48" />
                  <p class="text-body-1 mt-4">Loading items...</p>
                </div>

                <!-- Empty State -->
                <div v-else-if="itemsWithConversations.length === 0" class="text-center py-12">
                  <v-icon size="80" color="grey-lighten-1" class="mb-4">
                    mdi-package-variant-closed
                  </v-icon>
                  <h3 class="text-h5 text-grey-darken-1 mb-2">
                    No Items with Support Requests
                  </h3>
                  <p class="text-body-1 text-grey-darken-2 mb-4">
                    There are currently no items with student support conversations.
                  </p>
                </div>

                <!-- Items Grid -->
                <v-row v-else>
                  <v-col
                    v-for="item in itemsWithConversations"
                    :key="item.id"
                    cols="12"
                    sm="6"
                    md="4"
                    lg="3"
                  >
                    <v-card
                      class="item-card h-100"
                      elevation="2"
                      hover
                      @click="selectItem(item)"
                    >
                      <v-card-title class="d-flex justify-space-between align-start pb-2">
                        <div class="text-subtitle-1 font-weight-bold">{{ item.title }}</div>
                        <div class="d-flex align-center gap-1">
                          <!-- Unread Messages Badge -->
                          <v-badge
                            v-if="getUnreadMessageCount(item.id) > 0"
                            :content="getUnreadMessageCount(item.id)"
                            color="error"
                            inline
                            class="me-2"
                          >
                            <v-icon color="error" size="20">mdi-email-alert</v-icon>
                          </v-badge>
                          <v-chip
                            :color="item.status === 'lost' ? 'error' : 'success'"
                            size="x-small"
                            variant="flat"
                          >
                            {{ item.status.toUpperCase() }}
                          </v-chip>
                        </div>
                      </v-card-title>

                      <v-card-text>
                        <p class="text-body-2 text-grey-darken-1 mb-3" style="min-height: 60px;">
                          {{ item.description.substring(0, 80) }}{{ item.description.length > 80 ? '...' : '' }}
                        </p>

                        <v-divider class="my-3" />

                        <!-- Conversation Count and Unread Messages -->
                        <div class="d-flex align-center justify-space-between">
                          <div class="d-flex flex-column">
                            <div class="d-flex align-center text-caption text-grey-darken-1 mb-1">
                              <v-icon size="16" class="me-1">mdi-message-text</v-icon>
                              {{ getItemConversationCount(item.id) }}
                              {{ getItemConversationCount(item.id) === 1 ? 'conversation' : 'conversations' }}
                            </div>
                          </div>
                          <v-btn
                            color="primary"
                            variant="text"
                            size="small"
                            append-icon="mdi-chevron-right"
                          >
                            View
                          </v-btn>
                        </div>

                        <!-- Created Date -->
                        <div class="d-flex align-center text-caption text-grey mt-2">
                          <v-icon size="14" class="me-1">mdi-clock-outline</v-icon>
                          {{ new Date(item.created_at).toLocaleDateString() }}
                        </div>
                      </v-card-text>
                    </v-card>
                  </v-col>
                </v-row>
              </v-card>

              <!-- Direct Messages Card -->
              <v-card elevation="2" class="pa-4">
                <v-card-title class="text-h5 font-weight-bold mb-4 d-flex align-center">
                  <v-icon class="me-2" color="info">mdi-account-message</v-icon>
                  Users with Direct Messages
                  <v-spacer />
                  <v-chip
                    v-if="!loadingSupportConversations"
                    color="info"
                    variant="tonal"
                    :size="$vuetify.display.xs ? 'x-small' : 'small'"
                  >
                    {{ usersWithDirectMessages.length }} {{ usersWithDirectMessages.length === 1 ? 'User' : 'Users' }}
                  </v-chip>
                </v-card-title>

                <!-- Loading State -->
                <div v-if="loadingSupportConversations && directMessageConversations.length === 0" class="text-center py-12">
                  <v-progress-circular indeterminate color="primary" size="48" />
                  <p class="text-body-1 mt-4">Loading direct messages...</p>
                </div>

                <!-- Empty State -->
                <div v-else-if="usersWithDirectMessages.length === 0" class="text-center py-12">
                  <v-icon size="80" color="grey-lighten-1" class="mb-4">
                    mdi-account-message-outline
                  </v-icon>
                  <h3 class="text-h5 text-grey-darken-1 mb-2">
                    No Direct Messages
                  </h3>
                  <p class="text-body-1 text-grey-darken-2 mb-4">
                    Students haven't sent any direct messages yet.
                  </p>
                </div>

                <!-- Users Grid -->
                <v-row v-else>
                  <v-col
                    v-for="user in usersWithDirectMessages"
                    :key="user.id"
                    cols="12"
                    sm="6"
                    md="4"
                    lg="3"
                  >
                    <v-card
                      class="item-card h-100"
                      elevation="2"
                      hover
                      @click="selectUser(user)"
                    >
                      <v-card-title class="d-flex justify-space-between align-start pb-2">
                        <div class="d-flex align-center">
                          <v-avatar
                            color="info"
                            size="40"
                            class="me-2"
                          >
                            <span class="text-white font-weight-bold">
                              {{ user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) }}
                            </span>
                          </v-avatar>
                          <div>
                            <div class="text-subtitle-1 font-weight-bold">{{ user.full_name }}</div>
                          </div>
                        </div>
                        <div class="d-flex align-center gap-1">
                          <!-- Unread Messages Badge -->
                          <v-badge
                            v-if="user.unread_count > 0"
                            :content="user.unread_count"
                            color="error"
                            inline
                            class="me-2"
                          >
                            <v-icon color="error" size="20">mdi-email-alert</v-icon>
                          </v-badge>
                          <v-chip
                            color="info"
                            size="x-small"
                            variant="flat"
                          >
                            DIRECT
                          </v-chip>
                        </div>
                      </v-card-title>

                      <v-card-text>
                        <p class="text-body-2 text-grey-darken-1 mb-3" style="min-height: 60px;">
                          {{ user.email }}<br/>
                          <span class="text-caption">
                            General support conversations not related to specific items
                          </span>
                        </p>

                        <v-divider class="my-3" />

                        <!-- Conversation Count and Unread Messages -->
                        <div class="d-flex align-center justify-space-between">
                          <div class="d-flex flex-column">
                            <div class="d-flex align-center text-caption text-grey-darken-1 mb-1">
                              <v-icon size="16" class="me-1">mdi-message-text</v-icon>
                              {{ user.conversations.length }}
                              {{ user.conversations.length === 1 ? 'conversation' : 'conversations' }}
                            </div>
                          </div>
                          <v-btn
                            color="info"
                            variant="text"
                            size="small"
                            append-icon="mdi-chevron-right"
                          >
                            View
                          </v-btn>
                        </div>

                        <!-- Latest Message Date -->
                        <div class="d-flex align-center text-caption text-grey mt-2">
                          <v-icon size="14" class="me-1">mdi-clock-outline</v-icon>
                          {{ new Date(user.latest_message_date).toLocaleDateString() }}
                        </div>
                      </v-card-text>
                    </v-card>
                  </v-col>
                </v-row>
              </v-card>
            </div>

            <!-- Show User Messages View -->
            <div v-else-if="viewMode === 'user-messages' && selectedUser">
              <v-card elevation="2" class="pa-4">
                <!-- Back Button and User Info Header -->
                <div class="d-flex align-center mb-4">
                  <v-btn
                    icon="mdi-arrow-left"
                    variant="text"
                    @click="backToUsers"
                    class="me-3"
                  />
                  <div class="flex-grow-1">
                    <div class="d-flex align-center">
                      <v-avatar
                        color="info"
                        size="45"
                        class="me-3"
                      >
                        <span class="text-white font-weight-bold">
                          {{ selectedUser.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) }}
                        </span>
                      </v-avatar>
                      <div>
                        <h2 class="text-h5 font-weight-bold">{{ selectedUser.full_name }}</h2>
                        <p class="text-body-2 text-grey-darken-1 mb-0">{{ selectedUser.email }}</p>
                      </div>
                      <v-chip
                        color="info"
                        size="small"
                        variant="flat"
                        class="ml-3"
                      >
                        <v-icon start>mdi-lifebuoy</v-icon>
                        DIRECT SUPPORT
                      </v-chip>
                    </div>
                  </div>
                </div>

                <v-divider class="mb-4" />

                <v-card-title class="text-h6 font-weight-bold mb-4 d-flex align-center px-0">
                  <v-icon class="me-2" color="info">mdi-inbox</v-icon>
                  Direct Messages from {{ selectedUser.full_name }}
                  <v-spacer />
                  <v-chip
                    v-if="!loadingSupportConversations"
                    color="info"
                    variant="tonal"
                    :size="$vuetify.display.xs ? 'x-small' : 'small'"
                  >
                    {{ filteredConversations.length }}
                    {{ filteredConversations.length === 1 ? 'Conversation' : 'Conversations' }}
                  </v-chip>
                </v-card-title>

                <!-- Loading State -->
                <div v-if="loadingSupportConversations && supportConversations.length === 0" class="text-center py-12">
                  <v-progress-circular indeterminate color="primary" size="48" />
                  <p class="text-body-1 mt-4">Loading messages from {{ selectedUser.full_name }}...</p>
                </div>

                <!-- Empty State -->
                <div
                  v-else-if="!loadingSupportConversations && filteredConversations.length === 0"
                  class="text-center py-12"
                >
                  <v-icon size="80" color="grey-lighten-1" class="mb-4">
                    mdi-message-outline
                  </v-icon>
                  <h3 class="text-h5 text-grey-darken-1 mb-2">
                    No Messages from {{ selectedUser.full_name }}
                  </h3>
                  <p class="text-body-1 text-grey-darken-2 mb-4">
                    This user hasn't sent any direct messages yet.
                  </p>
                  <v-btn
                    color="info"
                    variant="outlined"
                    prepend-icon="mdi-arrow-left"
                    @click="backToUsers"
                  >
                    Back to Users
                  </v-btn>
                </div>

                <!-- Direct Messages Inbox -->
                <div v-else>
                  <!-- Same structure as item-based conversations but for direct messages -->
                  <div class="support-inbox-container">
                    <!-- Conversations List -->
                    <v-row>
                      <v-col cols="12" md="4">
                        <v-card variant="outlined" class="conversation-list">
                          <v-card-title class="text-h6 py-3 px-4 border-b d-flex justify-space-between align-center">
                            <div class="d-flex align-center">
                              <v-icon class="me-2">mdi-forum</v-icon>
                              Conversations
                              <v-btn
                                icon="mdi-refresh"
                                variant="text"
                                size="small"
                                class="ml-2"
                                :loading="loadingSupportConversations"
                                @click="loadSupportConversations(currentPage)"
                              />
                            </div>
                          </v-card-title>

                          <div v-if="loadingSupportConversations" class="pa-4 text-center">
                            <v-progress-circular indeterminate color="primary" size="24" />
                            <p class="text-caption mt-2">Loading...</p>
                          </div>

                          <div v-else class="pa-2">
                            <v-card
                              v-for="conversation in filteredConversations"
                              :key="conversation.id"
                              @click="selectSupportConversation(conversation)"
                              :class="{
                                'conversation-card-active': selectedSupportConversation?.id === conversation.id,
                                'conversation-card': true
                              }"
                              class="mb-3 pa-3"
                              elevation="2"
                              hover
                            >
                              <!-- Sender Information Header -->
                              <div class="d-flex align-center mb-3">
                                <v-badge
                                  v-if="conversationUnreadCounts[conversation.id] > 0"
                                  :content="conversationUnreadCounts[conversation.id]"
                                  color="error"
                                  overlap
                                >
                                  <v-avatar
                                    color="info"
                                    size="50"
                                    class="me-3"
                                  >
                                    <span class="text-white font-weight-bold text-h6">
                                      {{ (conversation.sender_profile?.full_name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) }}
                                    </span>
                                  </v-avatar>
                                </v-badge>
                                <v-avatar
                                  v-else
                                  color="info"
                                  size="50"
                                  class="me-3"
                                >
                                  <span class="text-white font-weight-bold text-h6">
                                    {{ (conversation.sender_profile?.full_name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) }}
                                  </span>
                                </v-avatar>

                                <div class="flex-grow-1">
                                  <div class="d-flex align-center justify-space-between">
                                    <div>
                                      <h3 class="text-h6 font-weight-bold mb-1">
                                        {{ conversation.sender_profile?.full_name || 'Student User' }}
                                      </h3>
                                      <p class="text-body-2 text-grey-darken-1 mb-0">
                                        {{ conversation.sender_profile?.email || 'No email available' }}
                                      </p>
                                    </div>
                                    <div class="d-flex align-center">
                                      <!-- Typing indicator -->
                                      <span
                                        v-if="conversationTypingStatus[conversation.id]?.isTyping"
                                        class="text-caption text-primary me-2"
                                      >
                                        typing...
                                      </span>
                                      <!-- Unread indicator -->
                                      <v-icon
                                        v-if="conversationUnreadCounts[conversation.id] > 0"
                                        color="error"
                                        size="20"
                                        class="me-2"
                                      >
                                        mdi-email-alert
                                      </v-icon>
                                      <!-- Date -->
                                      <div class="text-caption text-grey">
                                        {{ new Date(conversation.created_at).toLocaleDateString() }}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <!-- Direct Message Badge and Info -->
                              <div class="d-flex align-center justify-space-between">
                                <div class="d-flex align-center">
                                  <v-chip
                                    color="info"
                                    variant="elevated"
                                    size="small"
                                    class="font-weight-bold me-2"
                                  >
                                    <v-icon start size="16">mdi-lifebuoy</v-icon>
                                    GENERAL SUPPORT
                                  </v-chip>
                                  <span class="text-caption text-grey-darken-1">
                                    Direct message to admin support
                                  </span>
                                </div>

                                <v-btn
                                  color="info"
                                  variant="text"
                                  size="small"
                                  append-icon="mdi-chevron-right"
                                >
                                  Open
                                </v-btn>
                              </div>

                              <!-- Conversation started info -->
                              <v-divider class="my-2" />
                              <div class="d-flex align-center text-caption text-grey">
                                <v-icon size="14" class="me-1">mdi-clock-outline</v-icon>
                                Conversation started {{ new Date(conversation.created_at).toLocaleString() }}
                              </div>
                            </v-card>
                          </div>

                          <!-- Pagination Controls -->
                          <v-divider />
                          <div class="pa-3">
                            <div class="d-flex justify-space-between align-center">
                              <!-- Page Info -->
                              <div class="text-caption text-grey">
                                Showing {{ Math.min((currentPage - 1) * pageSize + 1, totalCount) }} -
                                {{ Math.min(currentPage * pageSize, totalCount) }} of {{ totalCount }} conversations
                              </div>

                              <!-- Page Size Selector -->
                              <div class="d-flex align-center">
                                <span class="text-caption me-2">Per page:</span>
                                <v-select
                                  :model-value="pageSize"
                                  @update:model-value="changePageSize"
                                  :items="[5, 10, 20, 50]"
                                  variant="outlined"
                                  density="compact"
                                  style="max-width: 80px;"
                                  hide-details
                                  :disabled="loadingSupportConversations"
                                />
                              </div>
                            </div>

                            <!-- Pagination Buttons -->
                            <div class="d-flex justify-center mt-2">
                              <v-pagination
                                v-if="totalPages > 1"
                                :model-value="currentPage"
                                @update:model-value="goToPage"
                                :length="totalPages"
                                :total-visible="5"
                                size="small"
                                :disabled="loadingSupportConversations"
                              />
                            </div>
                          </div>
                        </v-card>
                      </v-col>

                      <!-- Messages Area for Direct Messages -->
                      <v-col cols="12" md="8">
                        <v-card variant="outlined" class="messages-area">
                          <v-card-title v-if="selectedSupportConversation" class="py-4 px-4 border-b">
                            <div class="d-flex flex-column w-100">
                              <!-- User Info Header -->
                              <div class="d-flex align-center mb-3">
                                <v-avatar
                                  color="info"
                                  size="40"
                                  class="me-3"
                                >
                                  <span class="text-white font-weight-bold">
                                    {{ (selectedSupportConversation.sender_profile?.full_name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) }}
                                  </span>
                                </v-avatar>
                                <div>
                                  <div class="text-h6 font-weight-bold">
                                    {{ selectedSupportConversation.sender_profile?.full_name || 'Student User' }}
                                  </div>
                                  <div class="text-caption text-grey-darken-1">
                                    {{ selectedSupportConversation.sender_profile?.email }}
                                  </div>
                                </div>
                              </div>

                              <!-- Direct Message Card -->
                              <v-card variant="tonal" color="info" class="pa-3">
                                <div class="d-flex align-center">
                                  <v-chip color="info" variant="elevated" class="font-weight-bold">
                                    <v-icon start>mdi-lifebuoy</v-icon>
                                    GENERAL SUPPORT
                                  </v-chip>
                                </div>
                                <div class="text-body-2 mt-2">
                                  Direct conversation with student - No specific item involved
                                </div>
                              </v-card>
                            </div>
                          </v-card-title>

                          <v-card-title v-else class="text-h6 py-3 px-4 border-b text-center text-grey">
                            <v-icon class="me-2">mdi-message-outline</v-icon>
                            Select a direct message conversation to view
                          </v-card-title>

                          <!-- Content when conversation is selected -->
                          <template v-if="selectedSupportConversation">
                            <!-- Messages Display Container -->
                            <div v-if="loadingSupportMessages" class="pa-4 text-center" style="height: 400px;">
                              <v-progress-circular indeterminate color="primary" size="24" />
                              <p class="text-caption mt-2">Loading messages...</p>
                            </div>

                            <div v-else class="pa-4" style="height: 400px; overflow-y: auto;">
                              <div
                                v-for="message in supportInboxMessages"
                                :key="message.id"
                                class="message-item mb-3"
                                :class="{
                                  'message-sent': message.user_id === currentUser?.id,
                                  'message-received': message.user_id !== currentUser?.id
                                }"
                              >
                                <v-card
                                  variant="flat"
                                  :color="message.user_id === currentUser?.id ? 'primary' : 'grey-lighten-4'"
                                  :class="message.user_id === currentUser?.id ? 'ml-auto' : 'mr-auto'"
                                  style="max-width: 75%;"
                                >
                                  <v-card-text class="py-2 px-3">
                                    <p class="mb-1" :class="message.user_id === currentUser?.id ? 'text-white' : ''">
                                      {{ message.message }}
                                    </p>
                                    <div
                                      class="text-caption"
                                      :class="message.user_id === currentUser?.id ? 'text-grey-lighten-1' : 'text-grey'"
                                    >
                                      {{ new Date(message.created_at).toLocaleString() }}
                                    </div>
                                  </v-card-text>
                                </v-card>
                              </div>
                            </div>

                            <!-- Typing Indicator -->
                            <div v-if="isOtherUserTyping" class="px-4 pb-2">
                              <div class="d-flex align-center">
                                <v-avatar size="24" color="primary" class="me-2">
                                  <v-icon size="14" color="white">mdi-account</v-icon>
                                </v-avatar>
                                <div class="typing-indicator">
                                  <span class="text-caption text-grey-darken-1">
                                    {{ otherUserTypingName }} is typing
                                  </span>
                                  <span class="typing-dots">
                                    <span class="dot"></span>
                                    <span class="dot"></span>
                                    <span class="dot"></span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            <!-- Message Input - Always visible when conversation is selected -->
                            <v-divider />
                            <div class="pa-4">
                              <v-form @submit.prevent="handleSendMessage">
                                <v-text-field
                                  v-model="newMessage"
                                  label="Type your message..."
                                  variant="outlined"
                                  density="comfortable"
                                  :disabled="sendingSupportInboxMessage"
                                  append-inner-icon="mdi-send"
                                  @click:append-inner="handleSendMessage"
                                  @keyup.enter="handleSendMessage"
                                  @input="handleTyping"
                                />
                              </v-form>
                            </div>
                          </template>

                          <!-- No conversation selected state -->
                          <div v-else class="pa-8 text-center">
                            <v-icon size="60" color="grey-lighten-2">mdi-message-outline</v-icon>
                            <p class="text-h6 text-grey mt-4">Select a direct message to start responding</p>
                          </div>
                        </v-card>
                      </v-col>
                    </v-row>
                  </div>
                </div>
              </v-card>
            </div>

            <!-- Show Support Inbox when item is selected -->
            <v-card v-else-if="selectedItem && viewMode === 'items'" elevation="2" class="pa-4">
              <!-- Back Button and Item Info Header -->
              <div class="d-flex align-center mb-4">
                <v-btn
                  icon="mdi-arrow-left"
                  variant="text"
                  @click="backToItems"
                  class="me-3"
                />
                <div class="flex-grow-1">
                  <div class="d-flex align-center">
                    <v-icon class="me-2" color="primary">mdi-package-variant</v-icon>
                    <h2 class="text-h5 font-weight-bold">{{ selectedItem.title }}</h2>
                    <v-chip
                      :color="selectedItem.status === 'lost' ? 'error' : 'success'"
                      size="small"
                      variant="flat"
                      class="ml-3"
                    >
                      <v-icon start>
                        {{ selectedItem.status === 'lost' ? 'mdi-help' : 'mdi-check-circle' }}
                      </v-icon>
                      {{ selectedItem.status.toUpperCase() }} ITEM
                    </v-chip>
                  </div>
                  <p class="text-body-2 text-grey-darken-1 mt-2 mb-0">
                    {{ selectedItem.description }}
                  </p>
                </div>
              </div>

              <v-divider class="mb-4" />

              <v-card-title class="text-h6 font-weight-bold mb-4 d-flex align-center px-0">
                <v-icon class="me-2" color="primary">mdi-inbox</v-icon>
                Support Conversations for this Item
                <v-spacer />
                <v-chip
                  v-if="!loadingSupportConversations"
                  color="info"
                  variant="tonal"
                  :size="$vuetify.display.xs ? 'x-small' : 'small'"
                >
                  {{ filteredConversations.length }}
                  {{ filteredConversations.length === 1 ? 'Conversation' : 'Conversations' }}
                </v-chip>
              </v-card-title>

              <!-- Loading State -->
              <div v-if="loadingSupportConversations && supportConversations.length === 0" class="text-center py-12">
                <v-progress-circular indeterminate color="primary" size="48" />
                <p class="text-body-1 mt-4">Loading support conversations...</p>
              </div>

              <!-- Empty State -->
              <div
                v-else-if="!loadingSupportConversations && filteredConversations.length === 0"
                class="text-center py-12"
              >
                <v-icon size="80" color="grey-lighten-1" class="mb-4">
                  mdi-inbox-outline
                </v-icon>
                <h3 class="text-h5 text-grey-darken-1 mb-2">
                  No Support Messages for this Item
                </h3>
                <p class="text-body-1 text-grey-darken-2 mb-4">
                  No students have contacted support about this item yet.
                </p>
                <v-btn
                  color="primary"
                  variant="outlined"
                  prepend-icon="mdi-arrow-left"
                  @click="backToItems"
                >
                  Back to Items
                </v-btn>
              </div>

              <!-- Support Inbox Component -->
              <div v-else>
                <!-- Embedded Support Inbox without dialog wrapper -->
                <div class="support-inbox-container">
                  <!-- Conversations List -->
                  <v-row>
                    <v-col cols="12" md="4">
                      <v-card variant="outlined" class="conversation-list">
                        <v-card-title class="text-h6 py-3 px-4 border-b d-flex justify-space-between align-center">
                          <div class="d-flex align-center">
                            <v-icon class="me-2">mdi-forum</v-icon>
                            Conversations
                            <v-btn
                              icon="mdi-refresh"
                              variant="text"
                              size="small"
                              class="ml-2"
                              :loading="loadingSupportConversations"
                              @click="loadSupportConversations(currentPage)"
                            />
                          </div>
                        </v-card-title>

                        <div v-if="loadingSupportConversations" class="pa-4 text-center">
                          <v-progress-circular indeterminate color="primary" size="24" />
                          <p class="text-caption mt-2">Loading...</p>
                        </div>

                        <v-list v-else class="pa-0">
                          <v-list-item
                            v-for="conversation in filteredConversations"
                            :key="conversation.id"
                            @click="selectSupportConversation(conversation)"
                            :class="{ 'v-list-item--active': selectedSupportConversation?.id === conversation.id }"
                            class="conversation-item py-3"
                            lines="three"
                          >
                            <template v-slot:prepend>
                              <v-badge
                                v-if="conversationUnreadCounts[conversation.id] > 0"
                                :content="conversationUnreadCounts[conversation.id]"
                                color="error"
                                overlap
                              >
                                <v-avatar
                                  :color="conversation.item ? (conversation.item.status === 'lost' ? 'error' : 'success') : 'primary'"
                                  size="45"
                                  class="me-3"
                                >
                                  <span class="text-white font-weight-bold">
                                    {{ (conversation.sender_profile?.full_name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) }}
                                  </span>
                                </v-avatar>
                              </v-badge>
                              <v-avatar
                                v-else
                                :color="conversation.item ? (conversation.item.status === 'lost' ? 'error' : 'success') : 'primary'"
                                size="45"
                                class="me-3"
                              >
                                <span class="text-white font-weight-bold">
                                  {{ (conversation.sender_profile?.full_name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) }}
                                </span>
                              </v-avatar>
                            </template>

                            <!-- Main Content -->
                            <div class="d-flex flex-column">
                              <!-- User Info with unread indicator and typing indicator -->
                              <div class="d-flex align-center justify-space-between mb-1">
                                <div class="d-flex align-center">
                                  <v-list-item-title class="font-weight-bold">
                                    {{ conversation.sender_profile?.full_name || 'Student User' }}
                                  </v-list-item-title>
                                  <!-- Typing indicator in conversation list -->
                                  <span
                                    v-if="conversationTypingStatus[conversation.id]?.isTyping"
                                    class="text-caption text-primary ml-2"
                                  >
                                    typing...
                                  </span>
                                </div>
                                <v-icon
                                  v-if="conversationUnreadCounts[conversation.id] > 0"
                                  color="error"
                                  size="20"
                                  class="ml-2"
                                >
                                  mdi-email-alert
                                </v-icon>
                              </div>

                              <!-- Item Information - Made More Prominent -->
                              <div v-if="conversation.item" class="mb-2">
                                <v-chip
                                  :color="conversation.item.status === 'lost' ? 'error' : 'success'"
                                  variant="elevated"
                                  size="small"
                                  class="me-2 font-weight-bold"
                                >
                                  <v-icon start>
                                    {{ conversation.item.status === 'lost' ? 'mdi-help' : 'mdi-check-circle' }}
                                  </v-icon>
                                  {{ conversation.item.status.toUpperCase() }} ITEM
                                </v-chip>
                                <div class="text-subtitle-2 font-weight-medium text-primary mt-1">
                                  📦 {{ conversation.item.title }}
                                </div>
                                <div v-if="conversation.item.description" class="text-caption text-grey-darken-1 mt-1">
                                  {{ conversation.item.description.substring(0, 60) }}{{ conversation.item.description.length > 60 ? '...' : '' }}
                                </div>
                              </div>

                              <div v-else class="mb-2">
                                <v-chip
                                  color="info"
                                  variant="elevated"
                                  size="small"
                                  class="font-weight-bold"
                                >
                                  <v-icon start>mdi-lifebuoy</v-icon>
                                  GENERAL SUPPORT
                                </v-chip>
                              </div>
                            </div>

                            <template v-slot:append>
                              <div class="text-caption text-grey">
                                {{ new Date(conversation.created_at).toLocaleDateString() }}
                              </div>
                            </template>
                          </v-list-item>
                        </v-list>

                        <!-- Pagination Controls -->
                        <v-divider />
                        <div class="pa-3">
                          <div class="d-flex justify-space-between align-center">
                            <!-- Page Info -->
                            <div class="text-caption text-grey">
                              Showing {{ Math.min((currentPage - 1) * pageSize + 1, totalCount) }} -
                              {{ Math.min(currentPage * pageSize, totalCount) }} of {{ totalCount }} conversations
                            </div>

                            <!-- Page Size Selector -->
                            <div class="d-flex align-center">
                              <span class="text-caption me-2">Per page:</span>
                              <v-select
                                :model-value="pageSize"
                                @update:model-value="changePageSize"
                                :items="[5, 10, 20, 50]"
                                variant="outlined"
                                density="compact"
                                style="max-width: 80px;"
                                hide-details
                                :disabled="loadingSupportConversations"
                              />
                            </div>
                          </div>

                          <!-- Pagination Buttons -->
                          <div class="d-flex justify-center mt-2">
                            <v-pagination
                              v-if="totalPages > 1"
                              :model-value="currentPage"
                              @update:model-value="goToPage"
                              :length="totalPages"
                              :total-visible="5"
                              size="small"
                              :disabled="loadingSupportConversations"
                            />
                          </div>
                        </div>
                      </v-card>
                    </v-col>

                    <!-- Messages Area -->
                    <v-col cols="12" md="8">
                      <v-card variant="outlined" class="messages-area">
                        <v-card-title v-if="selectedSupportConversation" class="py-4 px-4 border-b">
                          <div class="d-flex flex-column w-100">
                            <!-- User Info Header -->
                            <div class="d-flex align-center mb-3">
                              <v-avatar
                                :color="selectedSupportConversation.item ? (selectedSupportConversation.item.status === 'lost' ? 'error' : 'success') : 'primary'"
                                size="40"
                                class="me-3"
                              >
                                <span class="text-white font-weight-bold">
                                  {{ (selectedSupportConversation.sender_profile?.full_name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) }}
                                </span>
                              </v-avatar>
                              <div>
                                <div class="text-h6 font-weight-bold">
                                  {{ selectedSupportConversation.sender_profile?.full_name || 'Student User' }}
                                </div>
                                <div class="text-caption text-grey-darken-1">
                                  {{ selectedSupportConversation.sender_profile?.email }}
                                </div>
                              </div>
                            </div>

                            <!-- Item Information Card -->
                            <v-card v-if="selectedSupportConversation.item" variant="tonal" :color="selectedSupportConversation.item.status === 'lost' ? 'error' : 'success'" class="pa-3">
                              <div class="d-flex align-center">
                                <v-chip
                                  :color="selectedSupportConversation.item.status === 'lost' ? 'error' : 'success'"
                                  variant="elevated"
                                  class="me-3 font-weight-bold"
                                >
                                  <v-icon start>
                                    {{ selectedSupportConversation.item.status === 'lost' ? 'mdi-help' : 'mdi-check-circle' }}
                                  </v-icon>
                                  {{ selectedSupportConversation.item.status.toUpperCase() }} ITEM
                                </v-chip>
                              </div>
                              <div class="text-h6 font-weight-bold mt-2 mb-1">
                                📦 {{ selectedSupportConversation.item.title }}
                              </div>
                              <div v-if="selectedSupportConversation.item.description" class="text-body-2">
                                {{ selectedSupportConversation.item.description }}
                              </div>
                            </v-card>

                            <!-- General Support Card -->
                            <v-card v-else variant="tonal" color="info" class="pa-3">
                              <div class="d-flex align-center">
                                <v-chip color="info" variant="elevated" class="font-weight-bold">
                                  <v-icon start>mdi-lifebuoy</v-icon>
                                  GENERAL SUPPORT
                                </v-chip>
                              </div>
                              <div class="text-body-2 mt-2">
                                General support conversation - No specific item involved
                              </div>
                            </v-card>
                          </div>
                        </v-card-title>

                        <v-card-title v-else class="text-h6 py-3 px-4 border-b text-center text-grey">
                          <v-icon class="me-2">mdi-message-outline</v-icon>
                          Select a conversation to view messages
                        </v-card-title>

                        <!-- Content when conversation is selected -->
                        <template v-if="selectedSupportConversation">
                          <!-- Messages Display Container -->
                          <div v-if="loadingSupportMessages" class="pa-4 text-center" style="height: 400px;">
                            <v-progress-circular indeterminate color="primary" size="24" />
                            <p class="text-caption mt-2">Loading messages...</p>
                          </div>

                          <div v-else class="pa-4" style="height: 400px; overflow-y: auto;">
                            <div
                              v-for="message in supportInboxMessages"
                              :key="message.id"
                              class="message-item mb-3"
                              :class="{
                                'message-sent': message.user_id === currentUser?.id,
                                'message-received': message.user_id !== currentUser?.id
                              }"
                            >
                              <v-card
                                variant="flat"
                                :color="message.user_id === currentUser?.id ? 'primary' : 'grey-lighten-4'"
                                :class="message.user_id === currentUser?.id ? 'ml-auto' : 'mr-auto'"
                                style="max-width: 75%;"
                              >
                                <v-card-text class="py-2 px-3">
                                  <p class="mb-1" :class="message.user_id === currentUser?.id ? 'text-white' : ''">
                                    {{ message.message }}
                                  </p>
                                  <div
                                    class="text-caption"
                                    :class="message.user_id === currentUser?.id ? 'text-grey-lighten-1' : 'text-grey'"
                                  >
                                    {{ new Date(message.created_at).toLocaleString() }}
                                  </div>
                                </v-card-text>
                              </v-card>
                            </div>
                          </div>

                          <!-- Typing Indicator -->
                          <div v-if="isOtherUserTyping" class="px-4 pb-2">
                            <div class="d-flex align-center">
                              <v-avatar size="24" color="primary" class="me-2">
                                <v-icon size="14" color="white">mdi-account</v-icon>
                              </v-avatar>
                              <div class="typing-indicator">
                                <span class="text-caption text-grey-darken-1">
                                  {{ otherUserTypingName }} is typing
                                </span>
                                <span class="typing-dots">
                                  <span class="dot"></span>
                                  <span class="dot"></span>
                                  <span class="dot"></span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <!-- Message Input - Always visible when conversation is selected -->
                          <v-divider />
                          <div class="pa-4">
                            <v-form @submit.prevent="handleSendMessage">
                              <v-text-field
                                v-model="newMessage"
                                label="Type your message..."
                                variant="outlined"
                                density="comfortable"
                                :disabled="sendingSupportInboxMessage"
                                append-inner-icon="mdi-send"
                                @click:append-inner="handleSendMessage"
                                @keyup.enter="handleSendMessage"
                                @input="handleTyping"
                              />
                            </v-form>
                          </div>
                        </template>

                        <!-- No conversation selected state -->
                        <div v-else class="pa-8 text-center">
                          <v-icon size="60" color="grey-lighten-2">mdi-message-outline</v-icon>
                          <p class="text-h6 text-grey mt-4">Select a conversation to start messaging</p>
                        </div>
                      </v-card>
                    </v-col>
                  </v-row>
                </div>
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </template>
  </InnerLayoutWrapper>
</template>

<style scoped>
.item-card {
  cursor: pointer;
  transition: all 0.3s ease;
}

.item-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15) !important;
}

.support-inbox-container {
  min-height: 600px;
}

.conversation-list {
  height: 600px;
  display: flex;
  flex-direction: column;
}

.conversation-list .v-list {
  flex: 1;
  overflow-y: auto;
}

.conversation-item {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 12px 16px !important;
}

.conversation-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.v-list-item--active {
  background-color: rgba(var(--v-theme-primary), 0.1) !important;
  border-right: 4px solid rgb(var(--v-theme-primary));
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

.conversation-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.conversation-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  border-color: rgba(var(--v-theme-info), 0.3);
}

.conversation-card-active {
  background-color: rgba(var(--v-theme-info), 0.1) !important;
  border-color: rgb(var(--v-theme-info)) !important;
  box-shadow: 0 4px 16px rgba(var(--v-theme-info), 0.3) !important;
}

.messages-area {
  height: 600px;
  display: flex;
  flex-direction: column;
}

.messages-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.message-item {
  display: flex;
  width: 100%;
}

.message-sent {
  justify-content: flex-end;
}

.message-received {
  justify-content: flex-start;
}

.border-b {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

/* Typing Indicator Styles */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.typing-dots {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
}

.typing-dots .dot {
  width: 6px;
  height: 6px;
  background-color: #666;
  border-radius: 50%;
  display: inline-block;
  animation: typingDot 1.4s infinite ease-in-out;
}

.typing-dots .dot:nth-child(1) {
  animation-delay: 0s;
}

.typing-dots .dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots .dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typingDot {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}
</style>
