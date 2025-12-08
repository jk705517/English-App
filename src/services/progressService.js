import { supabase } from './supabaseClient';
import { ITEM_TYPES } from '../utils/constants';

const STORAGE_KEY_V1 = 'learnedVideoIds';
const STORAGE_KEY_V2 = 'biubiu_progress_v2';

/**
 * Helper: Migrate v1 localStorage to v2 if needed
 */
function getLocalProgressV2() {
    try {
        const v2Data = localStorage.getItem(STORAGE_KEY_V2);
        if (v2Data) {
            return JSON.parse(v2Data);
        }

        const v1Data = localStorage.getItem(STORAGE_KEY_V1);
        if (v1Data) {
            const v1Ids = JSON.parse(v1Data);
            if (Array.isArray(v1Ids)) {
                const v2List = v1Ids.map(id => ({
                    itemType: ITEM_TYPES.VIDEO,
                    itemId: Number(id)
                }));
                localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(v2List));
                return v2List;
            }
        }
        return [];
    } catch (error) {
        console.error('Error parsing progress from localStorage:', error);
        return [];
    }
}

/**
 * Generic: Load learned items by type
 */
async function loadLearnedItems(user, itemType) {
    let localItems = getLocalProgressV2();
    const localIds = localItems
        .filter(item => item.itemType === itemType)
        .map(item => item.itemId);

    if (!user) return localIds;

    try {
        const { data, error } = await supabase
            .from('user_progress')
            .select('item_id')
            .eq('user_id', user.id)
            .eq('item_type', itemType);

        if (error) {
            console.error(`Error fetching user progress for ${itemType}:`, error);
            return localIds;
        }

        const remoteIds = data.map(item => item.item_id);

        // Sync to local v2
        const otherItems = localItems.filter(item => item.itemType !== itemType);
        const newItems = remoteIds.map(id => ({
            itemType: itemType,
            itemId: id
        }));
        localStorage.setItem(STORAGE_KEY_V2, JSON.stringify([...otherItems, ...newItems]));

        return remoteIds;
    } catch (err) {
        console.error('Unexpected error loading progress:', err);
        return localIds;
    }
}

/**
 * Generic: Toggle learned status
 */
async function toggleLearnedItem(user, itemType, itemId, isCurrentlyLearned) {
    let localItems = getLocalProgressV2();

    if (isCurrentlyLearned) {
        // Remove
        localItems = localItems.filter(item =>
            !(item.itemType === itemType && item.itemId === itemId)
        );
    } else {
        // Add
        const exists = localItems.some(item =>
            item.itemType === itemType && item.itemId === itemId
        );
        if (!exists) {
            localItems.push({ itemType, itemId });
        }
    }

    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(localItems));

    if (user) {
        try {
            if (isCurrentlyLearned) {
                // Remove from Supabase
                const { error } = await supabase
                    .from('user_progress')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('item_type', itemType)
                    .eq('item_id', itemId);

                if (error) console.error('Error deleting progress:', error);
            } else {
                // Add to Supabase
                const payload = {
                    user_id: user.id,
                    item_type: itemType,
                    item_id: itemId,
                    learned_at: new Date().toISOString()
                };

                // Legacy compatibility: if it's a video, we MUST provide video_id
                if (itemType === ITEM_TYPES.VIDEO) {
                    payload.video_id = itemId;
                }

                const { error } = await supabase
                    .from('user_progress')
                    .insert(payload);

                if (error) {
                    console.error('Error inserting progress:', error);
                    console.error('Payload was:', payload);
                }
            }
        } catch (err) {
            console.error('Unexpected error syncing progress:', err);
        }
    }
}

export const progressService = {
    /**
     * Load learned video IDs (Legacy Wrapper)
     */
    async loadLearnedVideoIds(user) {
        return loadLearnedItems(user, ITEM_TYPES.VIDEO);
    },

    /**
     * Toggle learned status for a video (Legacy Wrapper)
     */
    async toggleLearnedVideo(user, videoId, isCurrentlyLearned) {
        // Note: The original function returned the updated list of IDs. 
        // We should maintain that behavior if possible, or at least return the new list.
        // The original implementation returned `learnedIds`.

        await toggleLearnedItem(user, ITEM_TYPES.VIDEO, videoId, isCurrentlyLearned);

        // Return the updated list to match original signature's return value behavior
        return loadLearnedItems(null, ITEM_TYPES.VIDEO); // Read from local cache
    },

    // Legacy wrapper for backward compatibility
    async toggleLearnedVideoId(user, videoId, isLearned) {
        return toggleLearnedItem(user, ITEM_TYPES.VIDEO, videoId, isLearned);
    },

    // Expose generic methods
    loadLearnedItems,
    toggleLearnedItem
};
