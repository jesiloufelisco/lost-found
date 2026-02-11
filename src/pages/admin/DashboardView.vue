<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue'
import InnerLayoutWrapper from '@/layouts/InnerLayoutWrapper.vue'
import AdminDashboardItemCard from '@/pages/admin/components/DashboardItemCards.vue'
import ClaimItemDialog from '@/pages/admin/components/ClaimItemDialog.vue'
import StatsCards from '@/pages/admin/components/StatsCards.vue'
import SearchBar from '@/pages/admin/components/SearchBar.vue'
import RecentActivity from '@/pages/admin/components/RecentActivity.vue'
import PostItemDialog from '@/pages/admin/components/PostItemDialog.vue'
import ConfirmationDialog from '@/components/common/ConfirmationDialog.vue'
import ErrorDialog from '@/components/common/ErrorDialog.vue'
import { useDashboardData } from '@/pages/admin/components/composables/useDashboardData'
import { useAdminItemActions } from '@/pages/admin/components/composables/useAdminItems'
// import { handleClaimItem } from '@/stores/items'
import { markItemAsClaimed } from '@/stores/items'


import '@/styles/dashboardview.css'

interface Item {
  id: number
  title: string
  description: string
  status: 'lost' | 'found'
  user_id: string
  claimed_by: string
  created_at: string
}

const {
  loading,
  stats,
  items,
  fetchDashboardStats,
  getTotalUsersCount
} = useDashboardData()

const {
  postingItem,
  showPostDialog,
  updatingItems,
  newItemForm,
  postMissingItem,
  deleteItemById,
  showErrorDialog,
  errorMessage
} = useAdminItemActions(fetchDashboardStats)

// Claim dialog state
const showClaimDialog = ref(false)
const selectedItemForClaim = ref<Item | null>(null)

// Delete confirmation dialog state
const showDeleteDialog = ref(false)
const selectedItemForDelete = ref<Item | null>(null)
const deletingItem = ref(false)

// Handle showing claim dialog
const handleShowClaimDialog = (item: Item) => {
  selectedItemForClaim.value = item
  showClaimDialog.value = true
}

// Handle claim item with refresh
const onClaimItem = async (itemId: number, claimedBy: string) => {
  await markItemAsClaimed(itemId, claimedBy)
  await fetchDashboardStats()
}

// Handle delete item with confirmation
const handleDeleteItem = async (item: Item) => {
  selectedItemForDelete.value = item
  showDeleteDialog.value = true
}

// Confirm delete item
const confirmDeleteItem = async () => {
  if (!selectedItemForDelete.value) return

  deletingItem.value = true
  try {
    await deleteItemById(selectedItemForDelete.value.id)
    showDeleteDialog.value = false
    selectedItemForDelete.value = null
  } catch (error) {
    // Error is handled by the composable
  } finally {
    deletingItem.value = false
  }
}

// Cancel delete item
const cancelDeleteItem = () => {
  selectedItemForDelete.value = null
}

const searchQuery = ref('')

const filteredItems = computed(() => {
  if (!searchQuery.value.trim()) {
    return items.value
  }

  const query = searchQuery.value.toLowerCase().trim()
  return items.value.filter(item =>
    (item.title?.toLowerCase().includes(query)) ||
    (item.description?.toLowerCase().includes(query)) ||
    (item.status?.toLowerCase().includes(query))
  )
})

onMounted(async () => {
  await fetchDashboardStats()
  const userCount = await getTotalUsersCount()
  stats.value.totalUsers = userCount
})
</script>

<template>
  <InnerLayoutWrapper>
    <template #content>
      <div  class="dashboard container-fluid mx-2 mx-md-5 my-3 my-md-5">
        <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-4 mb-md-6 gap-3">
          <h1 class="text-h5 text-sm-h4 font-weight-bold text-green-darken-4">
            <span class="d-none d-sm-inline">CSU Lost & Found Dashboard</span>
            <span class="d-inline d-sm-none">CSU Dashboard</span>
          </h1>
          <div class="d-flex flex-column flex-sm-row gap-2 w-100 w-sm-auto">
            <v-btn
              color="success"
              prepend-icon="mdi-plus-circle"
              @click="showPostDialog = true"
              size="small"
              class="text-caption text-sm-body-2"
              block
              :class="{ 'mb-2 mb-sm-0': true }"
            >
              <span class="d-none d-sm-inline">Post Missing Item</span>
              <span class="d-inline d-sm-none">Post Item</span>
            </v-btn>

          </div>
        </div>

        <v-row v-if="loading">
          <v-col cols="12">
            <div class="d-flex justify-center align-center" style="height: 400px;">
              <v-progress-circular size="64" indeterminate color="primary" />
            </div>
          </v-col>
        </v-row>

        <template v-else>
          <StatsCards :stats="stats" />

          <v-row>
            <v-col cols="12" lg="12">
              <SearchBar v-model="searchQuery" />

              <div class="items-container">
                <div v-if="filteredItems.length === 0" class="text-center py-8">
                  <v-icon size="64" color="grey-lighten-1">
                    {{ searchQuery ? 'mdi-magnify' : 'mdi-inbox' }}
                  </v-icon>
                  <div class="text-h6 text-grey-darken-1 mt-2">
                    {{ searchQuery ? 'No items found' : 'No items posted yet' }}
                  </div>
                  <div class="text-body-2 text-grey-darken-1">
                    {{ searchQuery ? 'Try adjusting your search terms' : 'Posted items will appear here' }}
                  </div>
                </div>

                <v-row v-else>
                  <v-col
                    v-for="item in filteredItems"
                    :key="item.id"
                    cols="12"
                    md="6"
                    class="mb-3"
                  >
                    <AdminDashboardItemCard
                      :item="item"
                      :is-updating="updatingItems.has(item.id)"
                      @show-claim-dialog="handleShowClaimDialog"
                      @delete-item="handleDeleteItem"
                    />
                  </v-col>
                </v-row>
              </div>
            </v-col>


          </v-row>

          <RecentActivity :stats="stats" />
        </template>

        <PostItemDialog
          v-model="showPostDialog"
          :posting="postingItem"
          :form="newItemForm"
          @submit="postMissingItem"
        />

        <ClaimItemDialog
          v-model="showClaimDialog"
          :item="selectedItemForClaim"
          :loading="selectedItemForClaim ? updatingItems.has(selectedItemForClaim.id) : false"
          @claim-item="onClaimItem"
        />

        <ConfirmationDialog
          v-model="showDeleteDialog"
          title="Delete Item"
          :message="`Are you sure you want to delete '${selectedItemForDelete?.title}'? This action cannot be undone.`"
          confirm-text="Delete"
          cancel-text="Cancel"
          confirm-color="error"
          :loading="deletingItem"
          @confirm="confirmDeleteItem"
          @cancel="cancelDeleteItem"
        />

        <ErrorDialog
          v-model="showErrorDialog"
          :message="errorMessage"
        />
      </div>
    </template>
  </InnerLayoutWrapper>
</template>
