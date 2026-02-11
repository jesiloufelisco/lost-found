import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

const updatingItems = ref<Set<number>>(new Set())

export interface NewItemForm {
  title: string
  description: string
  status: 'lost' | 'found'
}

export interface Item {
  id: number
  title: string
  description: string
  status: 'lost' | 'found' | 'claimed'
  user_id: string
  claimed_by: string | null
  created_at: string
}

/**
 * Creates a new item in the database
 */
export async function createItem(
  itemData: NewItemForm,
  userId: string
): Promise<Item> {
  try {
    const { data, error } = await supabase
      .from('items')
      .insert([{
        title: itemData.title,
        description: itemData.description,
        status: itemData.status,
        user_id: userId,
        claimed_by: null
      }])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error creating item:', error)
    throw new Error('Failed to create item')
  }
}

/**
 * Marks an item as claimed by a specific user
 */
export async function markItemAsClaimed(
  itemId: number,
  claimedByUserId: string
): Promise<void> {
  updatingItems.value.add(itemId)

  try {
    const { error } = await supabase
      .from('items')
      .update({
        claimed_by: claimedByUserId,
        status: 'claimed',
      })
      .eq('id', itemId)

    if (error) throw error
  } catch (error) {
    console.error('Error marking item as claimed:', error)
    throw new Error('Failed to update item status to claimed')
  } finally {
    updatingItems.value.delete(itemId)
  }
}

/**
 * Alias for markItemAsClaimed - used for awarding items to specific users
 */
export const markAsClaimedBy = markItemAsClaimed

/**
 * Marks an item as unclaimed
 */
export async function markItemAsUnclaimed(itemId: number): Promise<void> {
  updatingItems.value.add(itemId)

  try {
    const { error } = await supabase
      .from('items')
      .update({
        claimed_by: null,
        status: 'lost', // or determine based on original status
      })
      .eq('id', itemId)

    if (error) throw error
  } catch (error) {
    console.error('Error marking item as unclaimed:', error)
    throw new Error('Failed to update item status to unclaimed')
  } finally {
    updatingItems.value.delete(itemId)
  }
}

/**
 * Deletes an item from the database
 */
export async function deleteItem(itemId: number): Promise<void> {
  updatingItems.value.add(itemId)

  try {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', itemId)

    if (error) throw error
  } catch (error) {
    console.error('Error deleting item:', error)
    throw new Error('Failed to delete item')
  } finally {
    updatingItems.value.delete(itemId)
  }
}

/**
 * Fetches all items from the database
 */
export async function fetchAllItems(): Promise<Item[]> {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching items:', error)
    throw new Error('Failed to fetch items')
  }
}

/**
 * Fetches items posted by a specific user
 */
export async function fetchItemsByUser(userId: string): Promise<Item[]> {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching user items:', error)
    throw new Error('Failed to fetch user items')
  }
}

export { updatingItems }
