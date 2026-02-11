<template>
  <v-card elevation="1" class="pa-4">
    <!-- Search Bar - Full width at top -->
    <v-row class="mb-4">
      <v-col cols="12">
        <v-text-field
          v-model="localSearchQuery"
          label="Search items..."
          placeholder="Search by title, description, location, or user..."
          variant="outlined"
          density="comfortable"
          prepend-inner-icon="mdi-magnify"
          clearable
          hide-details
        />
      </v-col>
    </v-row>

    <!-- Status Filter Toggle -->
    <v-row class="mb-3">
      <v-col cols="12">
        <v-chip-group
          v-model="localStatusFilter"
          selected-class="text-primary"
          mandatory
        >
          <v-chip
            value="active"
            variant="outlined"
            prepend-icon="mdi-package-variant"
            filter
          >
            Lost Items Only
          </v-chip>
          <v-chip
            value="claimed"
            variant="outlined"
            prepend-icon="mdi-package-variant-closed"
            filter
          >
            Claimed Items Only
          </v-chip>
          <v-chip
            value="all"
            variant="outlined"
            prepend-icon="mdi-view-list"
            filter
          >
            All Items
          </v-chip>
        </v-chip-group>
      </v-col>
    </v-row>

    <!-- Filters row -->
    <v-row align="center">
      <v-col cols="12" sm="6" md="3">
        <v-select
          v-model="localSortBy"
          :items="[
            { title: 'Newest First', value: 'newest' },
            { title: 'Oldest First', value: 'oldest' },
          ]"
          label="Sort By"
          variant="outlined"
          density="comfortable"
          prepend-inner-icon="mdi-sort"
          hide-details
        />
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-select
          v-model="localSelectedMonth"
          :items="[
            { title: 'All Months', value: 'all' },
            {
              title: `Current Month (${currentMonthLabel})`,
              value: currentMonthValue
            },
            ...availableMonths
              .filter(m => m !== currentMonthValue)
              .map((m) => ({
                title: formatMonthLabel(m),
                value: m,
              })),
          ]"
          label="Filter by Month"
          variant="outlined"
          density="comfortable"
          prepend-inner-icon="mdi-calendar-month"
          hide-details
        />
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-select
          v-model="localSelectedDay"
          :items="[
            { title: 'All Days', value: 'all' },
            ...(localSelectedMonth === currentMonthValue
              ? [{
                  title: `Today (${currentDayLabel})`,
                  value: currentDayValue
                }]
              : []),
            ...availableDays
              .filter(d => localSelectedMonth !== currentMonthValue || d !== currentDayValue)
              .map((d) => ({
                title: formatDayLabel(d),
                value: d,
              })),
          ]"
          label="Filter by Day"
          variant="outlined"
          density="comfortable"
          prepend-inner-icon="mdi-calendar"
          :disabled="
            localSelectedMonth === 'all' || availableDays.length === 0
          "
          hide-details
        />
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-select
          v-model="localItemsPerPage"
          :items="[8, 12, 16, 24, 48]"
          label="Items per page"
          variant="outlined"
          density="comfortable"
          prepend-inner-icon="mdi-view-grid"
          hide-details
        />
      </v-col>
    </v-row>

    <!-- Active filters chips -->
    <v-row
      v-if="localSelectedMonth !== 'all' || localSelectedDay !== 'all' || localSearchQuery.trim() || localStatusFilter !== 'active'"
      class="mt-2"
    >
      <v-col cols="12">
        <div class="d-flex align-center flex-wrap gap-2">
          <span class="text-caption text-grey-darken-1">Active filters:</span>

          <v-chip
            v-if="localSearchQuery.trim()"
            closable
            size="small"
            color="primary"
            variant="tonal"
            @click:close="localSearchQuery = ''"
          >
            <v-icon start size="small">mdi-magnify</v-icon>
            "{{ localSearchQuery.trim() }}"
          </v-chip>

          <v-chip
            v-if="localStatusFilter !== 'active'"
            closable
            size="small"
            color="primary"
            variant="tonal"
            @click:close="localStatusFilter = 'active'"
          >
            <v-icon start size="small">
              {{ localStatusFilter === 'claimed' ? 'mdi-package-variant-closed' : 'mdi-view-list' }}
            </v-icon>
            {{ localStatusFilter === 'claimed' ? 'Claimed Items' : 'All Items' }}
          </v-chip>

          <v-chip
            v-if="localSelectedMonth !== 'all'"
            closable
            size="small"
            color="primary"
            variant="tonal"
            @click:close="localSelectedMonth = 'all'"
          >
            <v-icon start size="small">mdi-calendar-month</v-icon>
            {{ formatMonthLabel(localSelectedMonth) }}
          </v-chip>

          <v-chip
            v-if="localSelectedDay !== 'all'"
            closable
            size="small"
            color="primary"
            variant="tonal"
            @click:close="localSelectedDay = 'all'"
          >
            <v-icon start size="small">mdi-calendar</v-icon>
            {{ formatDayLabel(localSelectedDay) }}
          </v-chip>

          <v-btn
            size="small"
            variant="text"
            color="error"
            @click="clearAllFilters"
          >
            Clear all
          </v-btn>
        </div>
      </v-col>
    </v-row>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface Props {
  searchQuery: string;
  sortBy: string;
  selectedMonth: string;
  selectedDay: string;
  itemsPerPage: number;
  statusFilter: string;
  availableMonths: string[];
  availableDays: string[];
  formatMonthLabel: (month: string) => string;
  formatDayLabel: (day: string) => string;
}

interface Emits {
  (e: 'update:searchQuery', value: string): void;
  (e: 'update:sortBy', value: string): void;
  (e: 'update:selectedMonth', value: string): void;
  (e: 'update:selectedDay', value: string): void;
  (e: 'update:itemsPerPage', value: number): void;
  (e: 'update:statusFilter', value: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Local reactive variables for two-way binding
const localSearchQuery = ref(props.searchQuery);
const localSortBy = ref(props.sortBy);
const localSelectedMonth = ref(props.selectedMonth);
const localSelectedDay = ref(props.selectedDay);
const localItemsPerPage = ref(props.itemsPerPage);
const localStatusFilter = ref(props.statusFilter);

// Watch for prop changes and update local values
watch(() => props.searchQuery, (newVal) => {
  localSearchQuery.value = newVal;
});

watch(() => props.sortBy, (newVal) => {
  localSortBy.value = newVal;
});

watch(() => props.selectedMonth, (newVal) => {
  localSelectedMonth.value = newVal;
});

watch(() => props.selectedDay, (newVal) => {
  localSelectedDay.value = newVal;
});

watch(() => props.itemsPerPage, (newVal) => {
  localItemsPerPage.value = newVal;
});

watch(() => props.statusFilter, (newVal) => {
  localStatusFilter.value = newVal;
});

// Watch local values and emit changes to parent
watch(localSearchQuery, (newVal) => {
  emit('update:searchQuery', newVal);
});

watch(localSortBy, (newVal) => {
  emit('update:sortBy', newVal);
});

watch(localSelectedMonth, (newVal) => {
  emit('update:selectedMonth', newVal);
});

watch(localSelectedDay, (newVal) => {
  emit('update:selectedDay', newVal);
});

watch(localItemsPerPage, (newVal) => {
  emit('update:itemsPerPage', newVal);
});

watch(localStatusFilter, (newVal) => {
  emit('update:statusFilter', newVal);
});

// Current date helpers
const currentDate = new Date();
const currentMonthValue = computed(() =>
  `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
);
const currentDayValue = computed(() =>
  `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
);
const currentMonthLabel = computed(() =>
  currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
);
const currentDayLabel = computed(() =>
  currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
);

// Clear all filters method
const clearAllFilters = () => {
  localSelectedMonth.value = 'all';
  localSelectedDay.value = 'all';
  localSearchQuery.value = '';
  localStatusFilter.value = 'active'; // Reset to default (lost items only)
};
</script>
