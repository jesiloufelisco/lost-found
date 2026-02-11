<script lang="ts" setup>
import { onMounted, computed, ref } from "vue";
import { useLandingController } from "@/controller/landingController";
import { useTheme } from "vuetify";
import OuterLayoutWrapper from "@/layouts/OuterLayoutWrapper.vue";

// Import external CSS
import "@/styles/landing.css";

const { data, loading, error, fetchLandingData } = useLandingController();
const theme = useTheme();
const isDark = computed(() => theme.global.current.value.dark);

// Animation states
const isVisible = ref(false);
const searchText = ref("");
const placeholderIndex = ref(0);
const typedText = ref("");
const currentFeature = ref(0);

const placeholders = [
  "Lost your student ID?",
  "Missing wallet?",
  "Can't find your laptop?",
  "Lost your notes?",
  "Missing phone?",
];

onMounted(() => {
  fetchLandingData();

  setTimeout(() => {
    isVisible.value = true;
  }, 100);

  // Rotating placeholder animation
  setInterval(() => {
    placeholderIndex.value = (placeholderIndex.value + 1) % placeholders.length;
  }, 3500);

  // Typewriter effect for hero subtitle
  const subtitle =
    "Helping CSU students reunite with their lost belongings through technology and community";
  let i = 0;
  const typeWriter = () => {
    if (i < subtitle.length) {
      typedText.value += subtitle.charAt(i);
      i++;
      setTimeout(typeWriter, 50);
    }
  };
  setTimeout(typeWriter, 1500);
});
</script>

<template>
  <OuterLayoutWrapper>
    <template #content>
      <!-- Loading State -->
      <v-container v-if="loading" class="loading-wrapper">
        <div class="loading-content">
          <div class="search-animation">
            <v-icon size="60" color="primary" class="search-icon"
              >mdi-magnify</v-icon
            >
            <div class="pulse-rings">
              <div class="pulse-ring"></div>
              <div class="pulse-ring delay-1"></div>
              <div class="pulse-ring delay-2"></div>
            </div>
          </div>
          <h2 class="loading-text">Searching for your content...</h2>
          <div class="loading-bar">
            <div class="loading-progress"></div>
          </div>
        </div>
      </v-container>

      <!-- Error State -->
      <v-alert v-else-if="error" type="error" class="error-state" rounded="lg">
        <template #prepend>
          <v-icon size="large">mdi-alert-circle</v-icon>
        </template>
        <div>
          <h3 class="text-h6 mb-2">Oops! Something went missing</h3>
          <p>{{ error }}</p>
        </div>
      </v-alert>

      <!-- Main Content -->
      <div v-else-if="data" class="landing-page">
        <!-- Hero Section -->
        <section class="hero-section">
          <div class="hero-background">
            <!-- Animated particles -->
            <div class="particles">
              <div
                v-for="i in 20"
                :key="`particle-${i}`"
                class="particle"
                :style="{
                  left: Math.random() * 100 + '%',
                  animationDelay: Math.random() * 20 + 's',
                  animationDuration: 15 + Math.random() * 10 + 's',
                }"
              ></div>
            </div>

            <!-- Gradient mesh -->
            <div class="gradient-mesh">
              <div class="mesh-gradient mesh-1"></div>
              <div class="mesh-gradient mesh-2"></div>
              <div class="mesh-gradient mesh-3"></div>
            </div>
          </div>

          <v-container class="hero-container" fluid>
            <v-row align="center" justify="center" class="hero-row">
              <v-col cols="12" lg="10" xl="8">
                <div class="hero-content">
                  <!-- Badge -->
                  

                  <!-- Main Title -->
                  <div class="hero-title-section">
                    <h1 class="hero-title" :class="{ visible: isVisible }">
                      <span class="title-highlight">Lost Something?</span><br />
                      <span class="title-main">We'll Help You Find It</span>
                    </h1>

                    <div class="title-decoration">
                      <div class="decoration-line"></div>
                      <v-icon color="primary" size="24">mdi-diamond</v-icon>
                      <div class="decoration-line"></div>
                    </div>
                  </div>

                  <!-- Animated Subtitle -->
                  <p class="hero-subtitle" :class="{ visible: isVisible }">
                    {{ typedText }}<span class="cursor">|</span>
                  </p>

                  <!-- Interactive Search Preview -->
                  <div class="search-preview" :class="{ visible: isVisible }">
                    <!-- <div class="search-container">
                      <v-text-field
                        v-model="searchText"
                        :placeholder="placeholders[placeholderIndex]"
                        prepend-inner-icon="mdi-magnify"
                        append-inner-icon="mdi-microphone"
                        variant="solo"
                        rounded="xl"
                        hide-details
                        class="search-input"
                        readonly
                      >
                        <template #append>
                          <v-btn
                            color="primary"
                            rounded="xl"
                            class="search-btn"
                          >
                            Search
                          </v-btn>
                        </template>
                      </v-text-field>

                     
                      <div class="search-suggestions">
                        <v-chip-group>
                          <v-chip size="small" variant="outlined" rounded="xl">
                            <v-icon start size="16">mdi-cellphone</v-icon>
                            Phone
                          </v-chip>
                          <v-chip size="small" variant="outlined" rounded="xl">
                            <v-icon start size="16">mdi-key</v-icon>
                            Keys
                          </v-chip>
                          <v-chip size="small" variant="outlined" rounded="xl">
                            <v-icon start size="16">mdi-wallet</v-icon>
                            Wallet
                          </v-chip>
                          <v-chip size="small" variant="outlined" rounded="xl">
                            <v-icon start size="16">mdi-laptop</v-icon>
                            Laptop
                          </v-chip>
                          <v-chip size="small" variant="outlined" rounded="xl">
                            <v-icon start size="16">mdi-notebook</v-icon>
                            Notebook
                          </v-chip>
                     
                          <v-chip size="small" variant="outlined" rounded="xl">
                            <v-icon start size="16">mdi-dots-horizontal</v-icon>
                            Others
                          </v-chip>
                        </v-chip-group>
                      </div>
                    </div> -->
                  </div>
                </div>
              </v-col>
            </v-row>
          </v-container>
        </section>
      </div>
    </template>
  </OuterLayoutWrapper>
</template>
