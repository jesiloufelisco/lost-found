import { supabase } from "@/lib/supabase";
import type { Conversation, Message } from "@/types/chat";

/**
 * Helper function to get user details via database function
 * Creates a function that returns user metadata from auth.users
 */
async function getUserDetails(userId: string) {
  try {
    const { data, error } = await supabase.rpc("get_user_details", {
      user_id: userId,
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.warn("Could not fetch user details for", userId);
    return {
      full_name: "Unknown User",
      email: "No email",
    };
  }
}

/**
 * Gets or creates an admin support conversation for a student
 * Admin support conversations have item_id = null
 */
export async function getOrCreateAdminSupportConversation(
  studentId: string,
  adminId: string
): Promise<Conversation> {
  try {
    // First, try to find existing admin support conversation
    const { data: existingConv, error: findError } = await supabase
      .from("conversations")
      .select("*")
      .is("item_id", null) // Admin support conversations have no item
      .eq("sender_id", studentId)
      .eq("receiver_id", adminId)
      .single();

    if (existingConv) {
      return existingConv;
    }

    // If not found (PGRST116 error), create new conversation
    if (findError && findError.code !== "PGRST116") {
      throw findError;
    }

    // Create new admin support conversation
    const { data: newConv, error: createError } = await supabase
      .from("conversations")
      .insert({
        item_id: null, // NULL indicates admin support chat
        sender_id: studentId,
        receiver_id: adminId,
      })
      .select()
      .single();

    if (createError) throw createError;
    return newConv;
  } catch (error) {
    console.error("Error getting/creating admin support conversation:", error);
    throw new Error("Failed to initialize admin support conversation");
  }
}

/**
 * Gets all admin support conversations (for admin inbox) with pagination
 * Returns conversations where item_id is null and conversations with items
 * For admins: Excludes conversations where they are the sender
 * For students (role 2): Shows conversations where they are sender or receiver
 */
export async function getAllAdminSupportConversations(
  page: number = 1,
  pageSize: number = 10
): Promise<{
  conversations: Conversation[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}> {
  try {
    // Get current user
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      throw new Error("No authenticated user found");
    }

    // Check user role
    const userRole = currentUser.app_metadata?.role || currentUser.user_metadata?.role;

    // Build query based on user role
    let countQuery = supabase
      .from("conversations")
      .select("*", { count: "exact", head: true });

    // For role 2 (students), show conversations where they are involved
    // For admins, exclude conversations where they are the sender
    if (userRole === 2) {
      countQuery = countQuery.or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);
    } else {
      countQuery = countQuery.neq("sender_id", currentUser.id);
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) throw countError;

    const totalPages = Math.ceil((totalCount || 0) / pageSize);

    // Calculate offset for pagination
    const offset = (page - 1) * pageSize;

    // Build conversations query
    let conversationsQuery = supabase
      .from("conversations")
      .select(
        `
        *,
        messages (
          message,
          created_at
        ),
        items:item_id (
          id,
          title,
          description,
          status
        )
      `
      );

    // Apply same filter based on user role
    if (userRole === 2) {
      conversationsQuery = conversationsQuery.or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);
    } else {
      conversationsQuery = conversationsQuery.neq("sender_id", currentUser.id);
    }

    // Get conversations with messages and item details
    const { data: conversations, error } = await conversationsQuery
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    if (!conversations || conversations.length === 0) {
      return {
        conversations: [],
        totalCount: totalCount || 0,
        totalPages,
        currentPage: page,
      };
    }

    // Get user details for each unique sender
    const senderIds = [...new Set(conversations.map((conv) => conv.sender_id))];
    const userDetailsPromises = senderIds.map((id) => getUserDetails(id));
    const userDetailsArray = await Promise.all(userDetailsPromises);

    // Create a map of userId -> userDetails
    const userDataMap = new Map();
    senderIds.forEach((id, index) => {
      userDataMap.set(id, userDetailsArray[index]);
    });

    // Process conversations
    const processedConversations: Conversation[] = conversations.map(
      (conv: any) => ({
        id: conv.id,
        item_id: conv.item_id,
        sender_id: conv.sender_id,
        receiver_id: conv.receiver_id,
        created_at: conv.created_at,
        sender_profile: userDataMap.get(conv.sender_id) || {
          full_name: "Unknown Student",
          email: "No email",
        },
        item: conv.items || null, // Include item details if available
        messages: conv.messages,
        latest_message:
          conv.messages && conv.messages.length > 0
            ? conv.messages[conv.messages.length - 1]
            : { message: "No messages yet", created_at: conv.created_at },
        message_count: conv.messages?.length || 0,
      })
    );

    return {
      conversations: processedConversations,
      totalCount: totalCount || 0,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    console.error("Error fetching admin support conversations:", error);
    throw new Error("Failed to load admin support conversations");
  }
}

/**
 * Gets the admin user ID using a database function
 * This queries auth.users to find user with role = 1 in metadata
 */
export async function getAdminUserId(): Promise<string> {
  try {
    const { data, error } = await supabase.rpc("get_admin_user_id");

    if (error) {
      console.error("Error calling get_admin_user_id:", error);
      throw error;
    }

    if (!data) {
      throw new Error(
        "No admin user found. Please ensure at least one user has role = 1 in their metadata."
      );
    }

    console.log("Found admin user ID:", data);
    return data;
  } catch (error) {
    console.error("Error finding admin user:", error);
    throw new Error("Failed to find admin user. Please contact support.");
  }
}

/**
 * Setup real-time subscription for admin support conversations using broadcast
 */
export function setupAdminSupportConversationsSubscription(
  onNewConversation: (conversation: Conversation) => void
) {
  const channel = supabase.channel("admin_support_conversations")
  
  return channel
    .on(
      "broadcast",
      { event: "new_conversation" },
      async (payload: any) => {
        try {
          const conversation = payload.payload as Conversation
          onNewConversation(conversation)
        } catch (error) {
          console.error("Error processing broadcast conversation:", error)
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "conversations",
      },
      async (payload: any) => {
        try {
          // Fallback to postgres_changes
          // Fetch the conversation
          const { data: conversation } = await supabase
            .from("conversations")
            .select("*")
            .eq("id", payload.new.id)
            .single();

          if (conversation) {
            // Get sender details
            const senderProfile = await getUserDetails(conversation.sender_id);

            const enrichedConversation = {
              ...conversation,
              sender_profile: senderProfile,
            };

            onNewConversation(enrichedConversation as Conversation);
          }
        } catch (error) {
          console.error("Error processing new conversation:", error);
        }
      }
    )
    .subscribe();
}

/**
 * Broadcasts a new conversation to all admin subscribers
 */
export async function broadcastNewConversation(
  conversation: Conversation
): Promise<void> {
  try {
    const channel = supabase.channel("admin_support_conversations")
    await channel.send({
      type: "broadcast",
      event: "new_conversation",
      payload: conversation
    })
  } catch (error) {
    console.error("Error broadcasting new conversation:", error)
  }
}

/**
 * Get unread message count for admin support (optional feature)
 */
export async function getUnreadAdminSupportCount(
  adminId: string
): Promise<number> {
  try {
    const { data: conversations, error: convError } = await supabase
      .from("conversations")
      .select("id")
      .is("item_id", null)
      .eq("receiver_id", adminId);

    if (convError) throw convError;

    if (!conversations || conversations.length === 0) {
      return 0;
    }

    return 0;
  } catch (error) {
    console.error("Error getting unread count:", error);
    return 0;
  }
}
