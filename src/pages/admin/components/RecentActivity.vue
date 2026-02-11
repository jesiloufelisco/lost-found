<script lang="ts" setup>
import { computed } from 'vue';
import {
  type ActivityItem,
  getActivityColor,
  getActivityIcon,
  formatTimestamp,
  filterRecentActivities
} from '@/utils/helpers';

interface Props {
  stats: any; // Accept any stats object structure
  maxItems?: number;
  maxDays?: number;
}

const props = withDefaults(defineProps<Props>(), {
  maxItems: 10,
  maxDays: 7
});

// Filter and limit recent activities using helper function with safe default
const filteredActivity = computed(() => {
  // Check if recentActivity exists in stats, otherwise return empty array
  const activities = props.stats?.recentActivity || [];
  return filterRecentActivities(activities, props.maxItems, props.maxDays);
});
</script>

<template>
  <v-row class="mt-4">
    <v-col cols="12">
      <v-card class="pa-4" elevation="2">
        <v-card-title class="text-h6 font-weight-bold mb-4">
          <v-icon class="me-2">mdi-clock-outline</v-icon>
          Recent Activity
          <v-chip
            v-if="filteredActivity.length > 0"
            class="ms-2"
            size="small"
            color="primary"
          >
            {{ filteredActivity.length }}
          </v-chip>
        </v-card-title>

        <div v-if="filteredActivity.length === 0" class="text-center py-8">
          <v-icon size="64" color="grey-lighten-1">mdi-inbox</v-icon>
          <div class="text-h6 text-grey-darken-1 mt-2">No recent activity</div>
          <div class="text-body-2 text-grey-darken-1">
            Items and activities from the last {{ maxDays }} days will appear here
          </div>
        </div>

        <v-list v-else>
          <v-list-item
            v-for="activity in filteredActivity"
            :key="activity.id"
            class="px-0"
          >
            <template #prepend>
              <v-avatar :color="getActivityColor(activity.type)" size="40">
                <v-icon :icon="getActivityIcon(activity.type)" color="white" />
              </v-avatar>
            </template>

            <v-list-item-title class="font-weight-medium">
              {{ activity.title }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{
                activity.type.charAt(0).toUpperCase() + activity.type.slice(1)
              }}
              {{ activity.status === 'claimed' ? 'claimed' : '' }} by {{ activity.user }}
            </v-list-item-subtitle>

            <template #append>
              <v-list-item-action>
                <v-chip size="small" variant="text" class="text-caption">
                  {{ formatTimestamp(activity.timestamp) }}
                </v-chip>
              </v-list-item-action>
            </template>
          </v-list-item>
        </v-list>
      </v-card>
    </v-col>
  </v-row>
</template>
