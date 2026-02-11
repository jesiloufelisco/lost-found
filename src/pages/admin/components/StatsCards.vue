<script lang="ts" setup>
interface Props {
  stats: {
    totalItems: number;
    lostItems: number;
    foundItems: number;
    resolvedItems: number;
  };
}

defineProps<Props>();
</script>

<template>
  <v-row class="mb-6">
    <v-col cols="12" md="3" sm="6">
      <v-card class="pa-4 text-center stat-card" elevation="2">
        <v-icon size="48" color="primary" class="mb-2"
          >mdi-package-variant</v-icon
        >
        <div class="text-h4 font-weight-bold text-primary">
          {{ stats.totalItems }}
        </div>
        <div class="text-subtitle-1 text-grey-darken-1">Total Items</div>
      </v-card>
    </v-col>

    <v-col cols="12" md="3" sm="6">
      <v-card class="pa-4 text-center stat-card" elevation="2">
        <v-icon size="48" color="error" class="mb-2">mdi-alert-circle</v-icon>
        <div class="text-h4 font-weight-bold text-error">
          {{ stats.lostItems }}
        </div>
        <div class="text-subtitle-1 text-grey-darken-1">Lost Items</div>
      </v-card>
    </v-col>

    <v-col cols="12" md="3" sm="6">
      <v-card class="pa-4 text-center stat-card" elevation="2">
        <v-icon size="48" color="success" class="mb-2">mdi-check-circle</v-icon>
        <div class="text-h4 font-weight-bold text-success">
          {{ stats.foundItems }}
        </div>
        <div class="text-subtitle-1 text-grey-darken-1">Found Items</div>
      </v-card>
    </v-col>

    <v-col cols="12" md="3" sm="6">
      <v-card class="pa-4 text-center stat-card" elevation="2">
        <v-icon size="48" color="info" class="mb-2">mdi-handshake</v-icon>
        <div class="text-h4 font-weight-bold text-info">
          {{ stats.resolvedItems }}
        </div>
        <div class="text-subtitle-1 text-grey-darken-1">Resolved</div>
      </v-card>
    </v-col>
  </v-row>
</template>
