import { progressAPI } from './api';

// ============================================
// 基础 API 封装函数
// ============================================

// 获取用户所有学习进度
export const getUserProgress = async (userId) => {
    try {
        const response = await progressAPI.getAll();
        return response.success ? response.data : [];
    } catch (error) {
        console.error('获取学习进度失败:', error);
        return [];
    }
};

// 添加学习进度
export const addProgress = async (userId, videoId, itemType, itemId) => {
    try {
        const response = await progressAPI.add(videoId, itemType, itemId);
        return response.success ? response.data : null;
    } catch (error) {
        console.error('添加学习进度失败:', error);
        return null;
    }
};

// 删除学习进度
export const deleteProgress = async (progressId) => {
    try {
        const response = await progressAPI.delete(progressId);
        return response.success;
    } catch (error) {
        console.error('删除学习进度失败:', error);
        return false;
    }
};

// 检查某个内容是否已学习
export const checkIfLearned = async (userId, videoId, itemType, itemId) => {
    try {
        const allProgress = await getUserProgress(userId);
        return allProgress.some(
            p => p.video_id === videoId && p.item_type === itemType && p.item_id === itemId
        );
    } catch (error) {
        console.error('检查学习状态失败:', error);
        return false;
    }
};

// 获取用户已学习的视频ID列表（直接导出函数）
export const loadLearnedVideoIds = async (user) => {
    if (!user) return [];
    try {
        const allProgress = await getUserProgress(user.id);
        // 过滤出 item_type 为 'video' 的进度
        const videoProgress = allProgress.filter(p => p.item_type === 'video');
        // 提取所有唯一的 video_id
        const videoIds = [...new Set(videoProgress.map(p => p.video_id))];
        return videoIds;
    } catch (error) {
        console.error('获取已学习视频ID失败:', error);
        return [];
    }
};

// ============================================
// 兼容层：与原有代码保持一致的 progressService 对象
// ============================================

export const progressService = {
    /**
     * 获取用户已学习的视频 ID 列表
     * @param {Object} user - 用户对象
     * @returns {Promise<Array<number>>}
     */
    loadLearnedVideoIds: async (user) => {
        return loadLearnedVideoIds(user);
    },

    /**
     * 切换视频学习状态
     * @param {Object} user - 用户对象
     * @param {number} videoId - 视频ID
     * @param {boolean} shouldBeLearned - 目标状态
     * @returns {Promise<boolean>}
     */
    toggleLearnedVideoId: async (user, videoId, shouldBeLearned) => {
        if (!user) return false;

        try {
            if (shouldBeLearned) {
                const result = await addProgress(user.id, videoId, 'video', videoId);
                return !!result;
            } else {
                // 需要先找到该进度的 ID
                const allProgress = await getUserProgress(user.id);
                const progress = allProgress.find(
                    p => p.item_type === 'video' && p.video_id === videoId
                );
                if (progress) {
                    return await deleteProgress(progress.id);
                }
                return true; // 已经不存在
            }
        } catch (error) {
            console.error('切换视频学习状态失败:', error);
            return false;
        }
    },

    /**
     * 添加学习进度
     * @param {Object} user - 用户对象
     * @param {number} videoId - 视频ID
     * @param {string} itemType - 类型
     * @param {number} itemId - 条目ID
     * @returns {Promise<Object>}
     */
    addProgress: async (user, videoId, itemType, itemId) => {
        if (!user) return null;
        return addProgress(user.id, videoId, itemType, itemId);
    },

    /**
     * 删除学习进度
     * @param {Object} user - 用户对象
     * @param {number} progressId - 进度ID
     * @returns {Promise<boolean>}
     */
    deleteProgress: async (user, progressId) => {
        if (!user) return false;
        return deleteProgress(progressId);
    },
};
