import { ref } from 'vue'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

interface Item {
  id: number
  title: string
  description: string
  status: 'lost' | 'found'
  user_id: string
  claimed_by: string
  created_at: string
}

interface DashboardStats {
  totalItems: number
  lostItems: number
  foundItems: number
  resolvedItems: number
  totalUsers: number
  totalConversations: number
  totalMessages: number
  recentActivity: Array<{
    id: string
    type: 'lost' | 'found' | 'resolved' | 'claimed'
    title: string
    user: string
    timestamp: string
    status: string
  }>
}

export const useDashboardData = () => {
  const loading = ref(true)
  const stats = ref<DashboardStats>({
    totalItems: 0,
    lostItems: 0,
    foundItems: 0,
    resolvedItems: 0,
    totalUsers: 0,
    totalConversations: 0,
    totalMessages: 0,
    recentActivity: []
  })
  const items = ref<Item[]>([])

  const fetchDashboardStats = async () => {
    loading.value = true;
    try {
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('id, title, description, status, claimed_by, user_id, created_at')
        .order('created_at', { ascending: false });

      if (itemsError) {
        console.error('Error fetching items:', itemsError);
        return;
      }

      items.value = itemsData || [];

      const totalItems = items.value.length;
      
      // Items are resolved if they have claimed_by set (regardless of lost/found status)
      const resolvedItems = items.value.filter(
        item => item.claimed_by !== null && item.claimed_by !== ''
      ).length;

      // Lost/Found items are only counted if they are NOT claimed (not resolved)
      const lostItems = items.value.filter(
        item => item.status === 'lost' && (item.claimed_by === null || item.claimed_by === '')
      ).length;
      
      const foundItems = items.value.filter(
        item => item.status === 'found' && (item.claimed_by === null || item.claimed_by === '')
      ).length;

      stats.value.totalItems = totalItems;
      stats.value.lostItems = lostItems;
      stats.value.foundItems = foundItems;
      stats.value.resolvedItems = resolvedItems;

      stats.value.recentActivity = items.value.map(item => {
        const isClaimed = item.claimed_by !== null && item.claimed_by !== '';
        
        return {
          id: String(item.id),
          type: isClaimed ? 'resolved' : item.status,
          title: item.title,
          user: item.user_id || 'Unknown User',
          timestamp: item.created_at,
          status: isClaimed ? 'Claimed' : (item.status === 'lost' ? 'Lost' : 'Found'),
        };
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      loading.value = false;
    }
  };

  const getTotalUsersCount = async () => {
    try {
      const { data: items } = await supabase
        .from('items')
        .select('user_id')
        .not('user_id', 'is', null)

      if (items) {
        const uniqueActiveUserIds = new Set(items.map(item => item.user_id))
        return uniqueActiveUserIds.size
      }

      return 0
    } catch (error) {
      console.error('Error getting active user count:', error)
      return 0
    }
  }

  return {
    loading,
    stats,
    items,
    fetchDashboardStats,
    getTotalUsersCount
  }
}