import { supabase } from './supabaseClient';

/**
 * Load favorite video IDs for the current user
 * @param {object|null} user - The authenticated user object from useAuth, or null if not logged in
 * @returns {Promise<number[]>} Array of favorite video IDs
 */
export async function loadFavoriteVideoIds(user) {
    try {
        if (user) {
            // Logged-in user: fetch from Supabase
            const { data, error } = await supabase
                .from('user_favorites')
                .select('video_id')
                .eq('user_id', user.id);

            if (error) {
                console.error('Error loading favorites from Supabase:', error);
                // Fallback to localStorage on error
                const localIds = JSON.parse(localStorage.getItem('favoriteVideoIds') || '[]');
                return localIds;
            }

            // Extract video_id array from data
            const favoriteIds = data.map(item => item.video_id);

            // Cache to localStorage
            localStorage.setItem('favoriteVideoIds', JSON.stringify(favoriteIds));

            return favoriteIds;
        } else {
            // Anonymous user: read from localStorage
            const localIds = JSON.parse(localStorage.getItem('favoriteVideoIds') || '[]');
            return localIds;
        }
    } catch (error) {
        console.error('Error in loadFavoriteVideoIds:', error);
        // Fallback to localStorage
        const localIds = JSON.parse(localStorage.getItem('favoriteVideoIds') || '[]');
        return localIds;
    }
}

/**
 * Toggle favorite status for a video
 * @param {object|null} user - The authenticated user object from useAuth, or null if not logged in
 * @param {number} videoId - The ID of the video to toggle
 * @param {boolean} isCurrentlyFavorite - Whether the video is currently favorited
 */
export async function toggleFavoriteVideo(user, videoId, isCurrentlyFavorite) {
    try {
        // Update localStorage immediately (optimistic update)
        const localIds = JSON.parse(localStorage.getItem('favoriteVideoIds') || '[]');

        if (isCurrentlyFavorite) {
            // Remove from favorites
            const updatedIds = localIds.filter(id => id !== videoId);
            localStorage.setItem('favoriteVideoIds', JSON.stringify(updatedIds));
        } else {
            // Add to favorites
            if (!localIds.includes(videoId)) {
                localIds.push(videoId);
                localStorage.setItem('favoriteVideoIds', JSON.stringify(localIds));
            }
        }

        // If user is logged in, sync to Supabase
        if (user) {
            if (isCurrentlyFavorite) {
                // Delete from user_favorites
                const { error } = await supabase
                    .from('user_favorites')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('video_id', videoId);

                if (error) {
                    console.error('Error removing favorite from Supabase:', error);
                }
            } else {
                // Insert into user_favorites
                const { error } = await supabase
                    .from('user_favorites')
                    .insert({
                        user_id: user.id,
                        video_id: videoId
                    });

                if (error) {
                    console.error('Error adding favorite to Supabase:', error);
                }
            }
        }
    } catch (error) {
        console.error('Error in toggleFavoriteVideo:', error);
    }
}

export const favoritesService = {
    loadFavoriteVideoIds,
    toggleFavoriteVideo
};
