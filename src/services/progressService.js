import { supabase } from './supabaseClient';

export const progressService = {
    /**
     * Load learned video IDs for the current user.
     * If user is logged in, fetch from Supabase and sync to localStorage.
     * If not logged in, read from localStorage.
     * @param {object} user - The current user object (or null)
     * @returns {Promise<number[]>} - Array of learned video IDs
     */
    async loadLearnedVideoIds(user) {
        if (user) {
            try {
                const { data, error } = await supabase
                    .from('user_progress')
                    .select('video_id')
                    .eq('user_id', user.id);

                if (error) {
                    console.error('Error fetching user progress:', error);
                    // Fallback to localStorage on error
                    return JSON.parse(localStorage.getItem('learnedVideoIds') || '[]');
                }

                const learnedIds = data.map(item => item.video_id);
                // Sync to localStorage
                localStorage.setItem('learnedVideoIds', JSON.stringify(learnedIds));
                return learnedIds;
            } catch (err) {
                console.error('Unexpected error loading progress:', err);
                return JSON.parse(localStorage.getItem('learnedVideoIds') || '[]');
            }
        } else {
            return JSON.parse(localStorage.getItem('learnedVideoIds') || '[]');
        }
    },

    /**
     * Toggle the learned status of a video.
     * @param {object} user - The current user object (or null)
     * @param {number} videoId - The ID of the video
     * @param {boolean} isCurrentlyLearned - Current learned status
     * @returns {Promise<number[]>} - Updated array of learned video IDs
     */
    async toggleLearnedVideo(user, videoId, isCurrentlyLearned) {
        let learnedIds = JSON.parse(localStorage.getItem('learnedVideoIds') || '[]');

        if (isCurrentlyLearned) {
            // Remove from local list
            learnedIds = learnedIds.filter(id => id !== videoId);
        } else {
            // Add to local list
            if (!learnedIds.includes(videoId)) {
                learnedIds.push(videoId);
            }
        }

        // Update localStorage
        localStorage.setItem('learnedVideoIds', JSON.stringify(learnedIds));

        if (user) {
            try {
                if (isCurrentlyLearned) {
                    // Remove from Supabase
                    const { error } = await supabase
                        .from('user_progress')
                        .delete()
                        .eq('user_id', user.id)
                        .eq('video_id', videoId);

                    if (error) console.error('Error deleting progress:', error);
                } else {
                    // Add to Supabase
                    const { error } = await supabase
                        .from('user_progress')
                        .insert({
                            user_id: user.id,
                            video_id: videoId,
                            learned_at: new Date().toISOString()
                        });

                    if (error) console.error('Error inserting progress:', error);
                }
            } catch (err) {
                console.error('Unexpected error syncing progress:', err);
            }
        }

        return learnedIds;
    }
};
