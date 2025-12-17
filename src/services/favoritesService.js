import { favoritesAPI } from './api';

// ============================================
// 基础 API 封装函数
// ============================================

// 获取用户所有收藏
export const getUserFavorites = async (userId) => {
    try {
        const response = await favoritesAPI.getAll();
        return response.success ? response.data : [];
    } catch (error) {
        console.error('获取收藏失败:', error);
        return [];
    }
};

// 添加收藏
export const addFavorite = async (userId, videoId, itemType, itemId) => {
    try {
        const response = await favoritesAPI.add(videoId, itemType, itemId);
        return response.success ? response.data : null;
    } catch (error) {
        console.error('添加收藏失败:', error);
        return null;
    }
};

// 删除收藏
export const deleteFavorite = async (favoriteId) => {
    try {
        const response = await favoritesAPI.delete(favoriteId);
        return response.success;
    } catch (error) {
        console.error('删除收藏失败:', error);
        return false;
    }
};

// 检查某个内容是否已收藏
export const checkIfFavorited = async (userId, videoId, itemType, itemId) => {
    try {
        const allFavorites = await getUserFavorites(userId);
        return allFavorites.some(
            f => f.video_id === videoId && f.item_type === itemType && f.item_id === itemId
        );
    } catch (error) {
        console.error('检查收藏状态失败:', error);
        return false;
    }
};

// ============================================
// 兼容层：与原有代码保持一致的 favoritesService 对象
// ============================================

export const favoritesService = {
    /**
     * 获取用户收藏的视频 ID 列表
     * @param {Object} user - 用户对象
     * @returns {Promise<Array<number>>}
     */
    loadFavoriteVideoIds: async (user) => {
        if (!user) return [];

        try {
            const allFavorites = await getUserFavorites(user.id);
            // 过滤出 item_type 为 'video' 的收藏
            const videoFavorites = allFavorites.filter(f => f.item_type === 'video');
            return videoFavorites.map(f => f.video_id);
        } catch (error) {
            console.error('加载收藏视频ID失败:', error);
            return [];
        }
    },

    /**
     * 获取用户在某个视频中收藏的句子 ID 列表
     * @param {Object} user - 用户对象
     * @param {number} videoId - 视频ID
     * @returns {Promise<Array<number>>}
     */
    loadFavoriteSentenceIds: async (user, videoId) => {
        if (!user) return [];

        try {
            const allFavorites = await getUserFavorites(user.id);
            // 过滤出该视频中 item_type 为 'sentence' 的收藏
            const sentenceFavorites = allFavorites.filter(
                f => f.item_type === 'sentence' && f.video_id === videoId
            );
            return sentenceFavorites.map(f => f.item_id);
        } catch (error) {
            console.error('加载收藏句子ID失败:', error);
            return [];
        }
    },

    /**
     * 获取用户在某个视频中收藏的词汇 ID 列表
     * @param {Object} user - 用户对象
     * @param {number} videoId - 视频ID
     * @returns {Promise<Array<number>>}
     */
    loadFavoriteVocabIds: async (user, videoId) => {
        if (!user) return [];

        try {
            const allFavorites = await getUserFavorites(user.id);
            // 过滤出该视频中 item_type 为 'vocab' 的收藏
            const vocabFavorites = allFavorites.filter(
                f => f.item_type === 'vocab' && f.video_id === videoId
            );
            return vocabFavorites.map(f => f.item_id);
        } catch (error) {
            console.error('加载收藏词汇ID失败:', error);
            return [];
        }
    },

    /**
     * 切换视频收藏状态
     * @param {Object} user - 用户对象
     * @param {number} videoId - 视频ID
     * @param {boolean} shouldBeFavorite - 目标状态
     * @returns {Promise<boolean>}
     */
    toggleFavoriteVideoId: async (user, videoId, shouldBeFavorite) => {
        if (!user) return false;

        try {
            if (shouldBeFavorite) {
                const result = await addFavorite(user.id, videoId, 'video', videoId);
                return !!result;
            } else {
                // 需要先找到该收藏的 ID
                const allFavorites = await getUserFavorites(user.id);
                const favorite = allFavorites.find(
                    f => f.item_type === 'video' && f.video_id === videoId
                );
                if (favorite) {
                    return await deleteFavorite(favorite.id);
                }
                return true; // 已经不存在
            }
        } catch (error) {
            console.error('切换视频收藏状态失败:', error);
            return false;
        }
    },

    /**
     * 切换句子收藏状态
     * @param {Object} user - 用户对象
     * @param {number} sentenceId - 句子ID
     * @param {boolean} shouldBeFavorite - 目标状态
     * @param {number} videoId - 视频ID
     * @returns {Promise<boolean>}
     */
    toggleFavoriteSentence: async (user, sentenceId, shouldBeFavorite, videoId) => {
        if (!user) return false;

        try {
            if (shouldBeFavorite) {
                const result = await addFavorite(user.id, videoId, 'sentence', sentenceId);
                return !!result;
            } else {
                // 需要先找到该收藏的 ID
                const allFavorites = await getUserFavorites(user.id);
                const favorite = allFavorites.find(
                    f => f.item_type === 'sentence' && f.item_id === sentenceId && f.video_id === videoId
                );
                if (favorite) {
                    return await deleteFavorite(favorite.id);
                }
                return true; // 已经不存在
            }
        } catch (error) {
            console.error('切换句子收藏状态失败:', error);
            return false;
        }
    },

    /**
     * 切换词汇收藏状态
     * @param {Object} user - 用户对象
     * @param {number} vocabId - 词汇ID
     * @param {boolean} shouldBeFavorite - 目标状态
     * @param {number} videoId - 视频ID
     * @returns {Promise<boolean>}
     */
    toggleFavoriteVocab: async (user, vocabId, shouldBeFavorite, videoId) => {
        if (!user) return false;

        try {
            if (shouldBeFavorite) {
                const result = await addFavorite(user.id, videoId, 'vocab', vocabId);
                return !!result;
            } else {
                // 需要先找到该收藏的 ID
                const allFavorites = await getUserFavorites(user.id);
                const favorite = allFavorites.find(
                    f => f.item_type === 'vocab' && f.item_id === vocabId && f.video_id === videoId
                );
                if (favorite) {
                    return await deleteFavorite(favorite.id);
                }
                return true; // 已经不存在
            }
        } catch (error) {
            console.error('切换词汇收藏状态失败:', error);
            return false;
        }
    },

    /**
     * 加载用户收藏的所有句子（带详细信息）
     * @param {Object} user - 用户对象
     * @returns {Promise<Array>}
     */
    loadFavoriteSentenceItems: async (user) => {
        if (!user) return [];

        try {
            const allFavorites = await getUserFavorites(user.id);
            // 过滤出 item_type 为 'sentence' 的收藏
            const sentenceFavorites = allFavorites.filter(f => f.item_type === 'sentence');

            // 返回带有详细信息的句子列表
            // 假设 API 返回的数据已经包含了句子的详细信息
            return sentenceFavorites.map(f => ({
                id: f.id,
                sentenceId: f.item_id,
                videoId: f.video_id,
                en: f.sentence_en || f.en || '',
                cn: f.sentence_cn || f.cn || '',
                episode: f.episode || 0,
                title: f.video_title || f.title || '',
                ...f.sentence_data, // 如果有额外的句子数据
            }));
        } catch (error) {
            console.error('加载收藏句子详情失败:', error);
            return [];
        }
    },

    /**
     * 加载用户收藏的所有词汇（带详细信息）
     * @param {Object} user - 用户对象
     * @returns {Promise<Array>}
     */
    loadFavoriteVocabItems: async (user) => {
        if (!user) return [];

        try {
            const allFavorites = await getUserFavorites(user.id);
            // 过滤出 item_type 为 'vocab' 的收藏
            const vocabFavorites = allFavorites.filter(f => f.item_type === 'vocab');

            // 返回带有详细信息的词汇列表
            // 假设 API 返回的数据已经包含了词汇的详细信息
            return vocabFavorites.map(f => ({
                id: f.id,
                vocabId: f.item_id,
                videoId: f.video_id,
                word: f.word || '',
                meaning: f.meaning || '',
                phonetic: f.phonetic || '',
                episode: f.episode || 0,
                title: f.video_title || f.title || '',
                ...f.vocab_data, // 如果有额外的词汇数据
            }));
        } catch (error) {
            console.error('加载收藏词汇详情失败:', error);
            return [];
        }
    },
};
