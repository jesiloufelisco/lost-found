import { computed } from "vue";

export function usePageConfig(isCurrentUserAdmin: any) {
  const pageTitle = computed(() =>
    isCurrentUserAdmin.value ? "Manage Lost & Found Items" : "Lost & Found"
  );

  const pageSubtitle = computed(() =>
    isCurrentUserAdmin.value
      ? "Manage your posted items and view conversations"
      : "Find your lost items or help others find theirs"
  );

  const emptyStateConfig = computed(() => ({
    noItemsTitle: isCurrentUserAdmin.value
      ? "No items posted yet"
      : "No missing items found",
    noItemsMessage: isCurrentUserAdmin.value
      ? "You haven't posted any missing items yet."
      : "There are currently no missing items posted by admins.",
    sectionTitle: isCurrentUserAdmin.value ? "Your Items" : "Missing Items",
  }));

  return {
    pageTitle,
    pageSubtitle,
    emptyStateConfig,
  };
}
