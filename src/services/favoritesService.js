import { supabase } from './supabaseClient';
import { ITEM_TYPES } from '../utils/constants';

const STORAGE_KEY_V1 = 'favoriteVideoIds';
const STORAGE_KEY_V2 = 'biubiu_favorites_v2';

/**
 * Helper: Migrate v1 localStorage to v2 if needed
 * @returns {Array} The v2 favorites array
 */
function getLocalFavoritesV2() {
    try {
        // 1. Try to read v2
        const v2Data = localStorage.getItem(STORAGE_KEY_V2);
        if (v2Data) {
            return JSON.parse(v2Data);
        }

        // 2. If v2 missing, check v1
        const v1Data = localStorage.getItem(STORAGE_KEY_V1);
        if (v1Data) {
            const v1Ids = JSON.parse(v1Data);
            if (Array.isArray(v1Ids)) {
                // Migrate: convert [1, 2] to [{ itemType: 'video', itemId: 1 }, ...]
                const v2List = v1Ids.map(id => ({
                    itemType: ITEM_TYPES.VIDEO,
                    itemId: Number(id)
                }));
                // Save to v2
                localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(v2List));
                return v2List;
            }
        }

        return [];
    } catch (error) {
        console.error('Error parsing favorites from localStorage:', error);
        return [];
    }
}

/**
 * Generic: Load favorite items by type
 * @param {object|null} user 
 * @param {string} itemType 
 * @returns {Promise<Array>} Array of item IDs (e.g. [1, 2, 3])
 */
async function loadFavoriteItems(user, itemType) {
    // Always sync/load from local v2 first
    let localItems = getLocalFavoritesV2();

    // Filter for the specific itemType to return simple IDs
    const localIds = localItems
        .filter(item => item.itemType === itemType)
        .map(item => item.itemId);

    if (!user) {
        return localIds;
    }

    // Logged-in: fetch from Supabase
    try {
        const { data, error } = await supabase
            .from('user_favorites')
            .select('item_id')
            .eq('user_id', user.id)
            .eq('item_type', itemType);

        if (error) {
            console.error(`Error loading favorites for ${itemType}:`, error);
            return localIds;
        }

        const remoteIds = data.map(row => row.item_id);

        // Merge remote items into local v2 cache
        // We need to be careful not to overwrite other itemTypes in localStorage
        // Strategy: 
        // 1. Keep other itemTypes from localItems
        // 2. Replace current itemType items with remoteIds
        const otherItems = localItems.filter(item => item.itemType !== itemType);
        const newItems = remoteIds.map(id => ({
            itemType: itemType,
            itemId: id
        }));

        const merged = [...otherItems, ...newItems];
        localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(merged));

        return remoteIds;
    } catch (error) {
        console.error('Error in loadFavoriteItems:', error);
        return localIds;
    }
}

/**
 * Load favorite items by type AND video (for sentence/vocab to avoid cross-video bleeding)
 * @param {object|null} user 
 * @param {string} itemType 
 * @param {number} videoId - The video ID to filter by
 * @returns {Promise<Array>} Array of item IDs belonging to this video
 */
async function loadFavoriteItemsByVideo(user, itemType, videoId) {
    // Load from localStorage v2, filtering by both itemType and videoId
    let localItems = getLocalFavoritesV2();
    const localIds = localItems
        .filter(item => item.itemType === itemType && item.videoId === videoId)
        .map(item => item.itemId);

    if (!user) {
        return localIds;
    }

    // Logged-in: fetch from Supabase with video_id filter
    try {
        const { data, error } = await supabase
            .from('user_favorites')
            .select('item_id')
            .eq('user_id', user.id)
            .eq('item_type', itemType)
            .eq('video_id', videoId);

        if (error) {
            console.error(`Error loading favorites for ${itemType} in video ${videoId}:`, error);
            return localIds;
        }

        return data.map(row => row.item_id);
    } catch (error) {
        console.error('Error in loadFavoriteItemsByVideo:', error);
        return localIds;
    }
}

/**
 * Generic: Set favorite status for an item
 * @param {object|null} user 
 * @param {string} itemType 
 * @param {number|string} itemId 
 * @param {boolean} shouldBeFavorite - The TARGET state: true = add to favorites, false = remove from favorites
 */
async function toggleFavoriteItem(user, itemType, itemId, shouldBeFavorite, videoId = null) {
    try {
        // 1. Optimistic update in localStorage (v2)
        let localItems = getLocalFavoritesV2();

        if (shouldBeFavorite) {
            // Target: ADD to favorites
            // For sentence/vocab, also include videoId in localStorage
            const newItem = { itemType, itemId };
            if (videoId && itemType !== ITEM_TYPES.VIDEO) {
                newItem.videoId = videoId;
            }
            const exists = localItems.some(item =>
                item.itemType === itemType && item.itemId === itemId &&
                (itemType === ITEM_TYPES.VIDEO || item.videoId === videoId)
            );
            if (!exists) {
                localItems.push(newItem);
            }
        } else {
            // Target: REMOVE from favorites
            localItems = localItems.filter(item =>
                !(item.itemType === itemType && item.itemId === itemId &&
                    (itemType === ITEM_TYPES.VIDEO || item.videoId === videoId))
            );
        }

        localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(localItems));

        // 2. Sync to Supabase if logged in
        if (user) {
            if (shouldBeFavorite) {
                // Insert (add to favorites)
                const payload = {
                    user_id: user.id,
                    item_type: itemType,
                    item_id: itemId
                };

                // Set video_id for all item types
                if (itemType === ITEM_TYPES.VIDEO) {
                    payload.video_id = itemId;
                } else if (videoId) {
                    payload.video_id = videoId;
                }

                const { error } = await supabase
                    .from('user_favorites')
                    .insert(payload);

                if (error) {
                    console.error('Error adding favorite to Supabase:', error);
                    console.error('Payload was:', payload);
                }
            } else {
                // Delete (remove from favorites)
                const { error } = await supabase
                    .from('user_favorites')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('item_type', itemType)
                    .eq('item_id', itemId);

                if (error) console.error('Error removing favorite from Supabase:', error);
            }
        }
    } catch (error) {
        console.error('Error in toggleFavoriteItem:', error);
    }
}

/**
 * Load favorite video IDs (Legacy Wrapper)
 */
export async function loadFavoriteVideoIds(user) {
    return loadFavoriteItems(user, ITEM_TYPES.VIDEO);
}

/**
 * Toggle favorite video (Legacy Wrapper)
 */
export async function toggleFavoriteVideo(user, videoId, isCurrentlyFavorite) {
    return toggleFavoriteItem(user, ITEM_TYPES.VIDEO, videoId, isCurrentlyFavorite);
}

// === Sentence Favorites ===

/**
 * Load favorite sentence IDs for a specific video
 * @param {object|null} user
 * @param {number} videoId - The video ID to filter by (required to avoid cross-video bleeding)
 * @returns {Promise<number[]>} Array of favorited sentence IDs for this video
 */
export async function loadFavoriteSentenceIds(user, videoId) {
    if (!videoId) {
        console.warn('loadFavoriteSentenceIds: videoId is required to avoid cross-video state bleeding');
        return [];
    }
    return loadFavoriteItemsByVideo(user, ITEM_TYPES.SENTENCE, videoId);
}

/**
 * Toggle sentence favorite status
 * @param {object|null} user
 * @param {number} sentenceId - The sentence's unique ID from transcript
 * @param {boolean} shouldBeFavorite - Target state: true = add, false = remove
 * @param {number|null} videoId - The video ID this sentence belongs to
 */
export async function toggleFavoriteSentence(user, sentenceId, shouldBeFavorite, videoId = null) {
    return toggleFavoriteItem(user, ITEM_TYPES.SENTENCE, sentenceId, shouldBeFavorite, videoId);
}

// === Vocab Favorites ===

/**
 * Load favorite vocab IDs for a specific video
 * @param {object|null} user
 * @param {number} videoId - The video ID to filter by (required to avoid cross-video bleeding)
 * @returns {Promise<number[]>} Array of favorited vocab IDs for this video
 */
export async function loadFavoriteVocabIds(user, videoId) {
    if (!videoId) {
        console.warn('loadFavoriteVocabIds: videoId is required to avoid cross-video state bleeding');
        return [];
    }
    return loadFavoriteItemsByVideo(user, ITEM_TYPES.VOCAB, videoId);
}

/**
 * Toggle vocab favorite status
 * @param {object|null} user
 * @param {number} vocabId - The vocab item's unique ID
 * @param {boolean} shouldBeFavorite - Target state: true = add, false = remove
 * @param {number|null} videoId - The video ID this vocab belongs to
 */
export async function toggleFavoriteVocab(user, vocabId, shouldBeFavorite, videoId = null) {
    return toggleFavoriteItem(user, ITEM_TYPES.VOCAB, vocabId, shouldBeFavorite, videoId);
}

// === Load Favorite Items with Details ===

/**
 * Load favorite sentence items with video details
 * @param {object|null} user
 * @returns {Promise<Array>} Array of favorite sentences with video info
 */
export async function loadFavoriteSentenceItems(user) {
    if (!user) return [];

    try {
        // 1. Get favorite sentence records (including video_id)
        const { data: favorites, error } = await supabase
            .from('user_favorites')
            .select('item_id, video_id')
            .eq('user_id', user.id)
            .eq('item_type', ITEM_TYPES.SENTENCE);

        if (error || !favorites?.length) return [];

        // 2. Get all related videos
        const videoIds = [...new Set(favorites.map(f => f.video_id).filter(Boolean))];
        if (videoIds.length === 0) return [];

        const { data: videos } = await supabase
            .from('videos')
            .select('id, title, episode, transcript')
            .in('id', videoIds);

        // 3. Match sentence details
        const result = [];
        for (const fav of favorites) {
            const video = videos?.find(v => v.id === fav.video_id);
            if (!video?.transcript) continue;
            const sentence = video.transcript.find(t => t.id === fav.item_id);
            if (sentence) {
                result.push({
                    sentenceId: fav.item_id,
                    videoId: fav.video_id,
                    en: sentence.text || sentence.en,  // Handle both field names
                    cn: sentence.cn,
                    start: sentence.start,
                    episode: video.episode,
                    title: video.title
                });
            }
        }
        return result;
    } catch (error) {
        console.error('Error loading favorite sentences:', error);
        return [];
    }
}

/**
 * Load favorite vocab items with video details
 * @param {object|null} user
 * @returns {Promise<Array>} Array of favorite vocab items with video info
 */
export async function loadFavoriteVocabItems(user) {
    if (!user) return [];

    try {
        const { data: favorites, error } = await supabase
            .from('user_favorites')
            .select('item_id, video_id')
            .eq('user_id', user.id)
            .eq('item_type', ITEM_TYPES.VOCAB);

        if (error || !favorites?.length) return [];

        const videoIds = [...new Set(favorites.map(f => f.video_id).filter(Boolean))];
        if (videoIds.length === 0) return [];

        const { data: videos } = await supabase
            .from('videos')
            .select('id, title, episode, vocab')
            .in('id', videoIds);

        const result = [];
        for (const fav of favorites) {
            const video = videos?.find(v => v.id === fav.video_id);
            if (!video?.vocab) continue;
            const vocabItem = video.vocab.find(v => v.id === fav.item_id);
            if (vocabItem) {
                result.push({
                    vocabId: fav.item_id,
                    videoId: fav.video_id,
                    word: vocabItem.word,
                    phonetic: vocabItem.ipa_us || vocabItem.phonetic,
                    meaning: vocabItem.meaning,
                    episode: video.episode,
                    title: video.title
                });
            }
        }
        return result;
    } catch (error) {
        console.error('Error loading favorite vocab:', error);
        return [];
    }
}

// Legacy wrapper for backward compatibility
export async function toggleFavoriteVideoId(user, videoId, isFavorite) {
    return toggleFavoriteItem(user, ITEM_TYPES.VIDEO, videoId, isFavorite);
}

export const favoritesService = {
    // Video favorites
    loadFavoriteVideoIds,
    toggleFavoriteVideo,
    toggleFavoriteVideoId,
    // Sentence favorites
    loadFavoriteSentenceIds,
    loadFavoriteSentenceItems,
    toggleFavoriteSentence,
    // Vocab favorites
    loadFavoriteVocabIds,
    loadFavoriteVocabItems,
    toggleFavoriteVocab,
    // Generic methods
    loadFavoriteItems,
    toggleFavoriteItem
};
