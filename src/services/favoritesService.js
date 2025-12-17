import { favoritesAPI } from './api';
import { supabase } from './supabaseClient';

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
            f => f.video_id === videoId && f.item_type === itemType && String(f.item_id) === String(itemId)
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
     * @returns {Promise<Array<string|number>>}
     */
    loadFavoriteSentenceIds: async (user, videoId) => {
        if (!user) return [];

        try {
            const allFavorites = await getUserFavorites(user.id);
            // 过滤出该视频中 item_type 为 'sentence' 的收藏
            const sentenceFavorites = allFavorites.filter(
                f => f.item_type === 'sentence' && f.video_id === videoId
            );
            // 返回 item_id (可能是 number 或 string 如 "123-0")
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
     * @param {number|string} sentenceId - 句子ID (可能是 number 或 fallback string 如 "123-0")
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
                    f => f.item_type === 'sentence' && String(f.item_id) === String(sentenceId) && f.video_id === videoId
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
     * 需要从 Supabase 获取视频数据来提取句子内容
     * @param {Object} user - 用户对象
     * @returns {Promise<Array>}
     */
    loadFavoriteSentenceItems: async (user) => {
        if (!user) return [];

        try {
            const allFavorites = await getUserFavorites(user.id);
            // 过滤出 item_type 为 'sentence' 的收藏
            const sentenceFavorites = allFavorites.filter(f => f.item_type === 'sentence');

            if (sentenceFavorites.length === 0) return [];

            // 获取所有相关视频的 ID
            const videoIds = [...new Set(sentenceFavorites.map(f => f.video_id))];

            // 从 Supabase 获取视频数据
            const { data: videos, error } = await supabase
                .from('videos')
                .select('id, title, episode, transcript')
                .in('id', videoIds);

            if (error) {
                console.error('获取视频数据失败:', error);
                return [];
            }

            // 创建 videoId -> video 的映射
            const videoMap = {};
            videos.forEach(v => { videoMap[v.id] = v; });

            // 为每个收藏的句子查找对应的内容
            const enrichedSentences = sentenceFavorites.map(f => {
                const video = videoMap[f.video_id];
                if (!video || !video.transcript) {
                    return {
                        id: f.id,
                        sentenceId: f.item_id,
                        videoId: f.video_id,
                        en: '',
                        cn: '',
                        episode: 0,
                        title: ''
                    };
                }

                // 查找句子：先按 id 匹配，如果是 fallback ID (如 "123-0")，则解析 index
                let sentence = null;
                const itemId = f.item_id;

                // 尝试直接按 id 查找
                sentence = video.transcript.find(s => s.id === itemId || String(s.id) === String(itemId));

                // 如果没找到，尝试解析 fallback ID 格式 "videoId-index"
                if (!sentence && typeof itemId === 'string' && itemId.includes('-')) {
                    const parts = itemId.split('-');
                    const index = parseInt(parts[parts.length - 1], 10);
                    if (!isNaN(index) && video.transcript[index]) {
                        sentence = video.transcript[index];
                    }
                }

                // 如果还是没找到，尝试按数字索引
                if (!sentence && typeof itemId === 'number' && video.transcript[itemId]) {
                    sentence = video.transcript[itemId];
                }

                return {
                    id: f.id,
                    sentenceId: f.item_id,
                    videoId: f.video_id,
                    en: sentence?.text || sentence?.en || '',
                    cn: sentence?.cn || '',
                    episode: video.episode || 0,
                    title: video.title || ''
                };
            }).filter(s => s.en || s.cn); // 过滤掉找不到内容的

            return enrichedSentences;
        } catch (error) {
            console.error('加载收藏句子详情失败:', error);
            return [];
        }
    },

    /**
     * 加载用户收藏的所有词汇（带详细信息）
     * 需要从 Supabase 获取视频数据来提取词汇内容
     * @param {Object} user - 用户对象
     * @returns {Promise<Array>}
     */
    loadFavoriteVocabItems: async (user) => {
        if (!user) return [];

        try {
            const allFavorites = await getUserFavorites(user.id);
            // 过滤出 item_type 为 'vocab' 的收藏
            const vocabFavorites = allFavorites.filter(f => f.item_type === 'vocab');

            if (vocabFavorites.length === 0) return [];

            // 获取所有相关视频的 ID
            const videoIds = [...new Set(vocabFavorites.map(f => f.video_id))];

            // 从 Supabase 获取视频数据
            const { data: videos, error } = await supabase
                .from('videos')
                .select('id, title, episode, vocab')
                .in('id', videoIds);

            if (error) {
                console.error('获取视频数据失败:', error);
                return [];
            }

            // 创建 videoId -> video 的映射
            const videoMap = {};
            videos.forEach(v => { videoMap[v.id] = v; });

            // 为每个收藏的词汇查找对应的内容
            const enrichedVocabs = vocabFavorites.map(f => {
                const video = videoMap[f.video_id];
                if (!video || !video.vocab) {
                    return {
                        id: f.id,
                        vocabId: f.item_id,
                        videoId: f.video_id,
                        word: '',
                        meaning: '',
                        phonetic: '',
                        episode: 0,
                        title: ''
                    };
                }

                // 查找词汇：按 id 匹配
                const itemId = f.item_id;
                let vocabItem = video.vocab.find(v => v.id === itemId || String(v.id) === String(itemId));

                // 如果没找到，尝试按数字索引
                if (!vocabItem && typeof itemId === 'number' && video.vocab[itemId]) {
                    vocabItem = video.vocab[itemId];
                }

                return {
                    id: f.id,
                    vocabId: f.item_id,
                    videoId: f.video_id,
                    word: vocabItem?.word || '',
                    meaning: vocabItem?.meaning || '',
                    phonetic: vocabItem?.ipa_us || vocabItem?.phonetic || '',
                    episode: video.episode || 0,
                    title: video.title || ''
                };
            }).filter(v => v.word); // 过滤掉找不到内容的

            return enrichedVocabs;
        } catch (error) {
            console.error('加载收藏词汇详情失败:', error);
            return [];
        }
    },
};
