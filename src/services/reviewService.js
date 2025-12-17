// src/services/reviewService.js
import { reviewStatesAPI, reviewLogsAPI } from './api';

/**
 * 记录一次复习结果并更新复习状态
 * 现在通过后端 API 处理，后端会同时记录日志和更新状态
 * @param {Object} params
 * @param {'vocab'|'sentence'} params.itemType - 复习对象类型
 * @param {string} params.itemId - 该词/句子的唯一标识
 * @param {boolean} params.isKnown - true=我会了, false=还不熟
 * @param {string} [params.videoId] - 所属视频 id（可选）
 * @param {string} [params.notebookId] - 所属本子 id（可选）
 * @param {string} [params.reviewMode] - 复习模式，比如 'vocab_review' / 'sentence_review'
 * @param {string} userId - 当前用户 id（后端从 token 获取，此参数仅用于前端检查）
 */
export async function recordReviewLog({
    itemType,
    itemId,
    isKnown,
    videoId,
    notebookId,
    reviewMode,
}, userId) {
    // 现在 recordReviewLog 和 updateReviewState 合并为一个后端调用
    // 这个函数保留是为了兼容，实际逻辑在 updateReviewState 中
    console.log('[recordReviewLog] called, delegating to updateReviewState');
}

/**
 * 根据本次复习结果，更新复习状态
 * 调用后端 API POST /api/user/review-states
 * 后端会处理熟练度计算和下次复习时间
 * 
 * @param {Object} params
 * @param {'vocab'|'sentence'} params.itemType - 复习对象类型
 * @param {string} params.itemId - 该词/句子的唯一标识
 * @param {boolean} params.isKnown - true=我会了, false=还不熟
 * @param {string} [params.videoId] - 所属视频 id（可选）
 * @param {string} [params.notebookId] - 所属本子 id（可选）
 * @param {string} userId - 当前用户 id（后端从 token 获取，此参数仅用于前端检查）
 */
export async function updateReviewState({
    itemType,
    itemId,
    isKnown,
    videoId,
    notebookId,
}, userId) {
    try {
        if (!userId) {
            console.warn('[updateReviewState] no user, skip');
            return;
        }

        const payload = {
            item_type: itemType,
            item_id: String(itemId),
            video_id: videoId ? String(videoId) : null,
            notebook_id: notebookId ? String(notebookId) : null,
            last_result_known: !!isKnown,
        };

        console.log('[updateReviewState] calling API with:', payload);

        const response = await reviewStatesAPI.update(payload);

        if (response.success) {
            console.log('[updateReviewState] success:', response.data);
        } else {
            console.error('[updateReviewState] API returned success:false');
        }
    } catch (err) {
        console.error('[updateReviewState] unexpected error:', err);
    }
}

// ========== 复习统计 v0.1 ==========

/**
 * 获取最近 N 天的复习统计数据
 * @param {Object} user - 当前用户对象
 * @param {Object} options - 可选参数
 * @param {number} options.days - 统计天数，默认 7
 * @returns {Promise<{days: Array, summary: Object}>}
 */
export async function loadReviewStats(user, { days = 7 } = {}) {
    try {
        if (!user || !user.id) {
            console.warn('[loadReviewStats] no user, returning empty stats');
            return getEmptyStats(days);
        }

        // 调用新 API
        const response = await reviewLogsAPI.getStats(days);

        if (!response.success) {
            console.error('[loadReviewStats] API returned success:false');
            return getEmptyStats(days);
        }

        const logs = response.data || [];

        // 按本地日期分组
        const dateMap = new Map();

        for (const log of logs) {
            const localDate = new Date(log.created_at);
            const dateKey = formatDateKey(localDate);

            if (!dateMap.has(dateKey)) {
                dateMap.set(dateKey, { total: 0, vocab: 0, sentence: 0 });
            }

            const stats = dateMap.get(dateKey);
            stats.total += 1;
            if (log.item_type === 'vocab') {
                stats.vocab += 1;
            } else if (log.item_type === 'sentence') {
                stats.sentence += 1;
            }
        }

        // 生成最近 days 天的数据
        const now = new Date();
        const daysArray = [];
        for (let i = 0; i < days; i++) {
            const date = new Date(now);
            date.setDate(now.getDate() - i);
            const dateKey = formatDateKey(date);
            const label = getDayLabel(i);
            const stats = dateMap.get(dateKey) || { total: 0, vocab: 0, sentence: 0 };

            daysArray.push({
                date: dateKey,
                label,
                total: stats.total,
                vocab: stats.vocab,
                sentence: stats.sentence,
            });
        }

        // 计算汇总
        let totalCount = 0;
        let vocabCount = 0;
        let sentenceCount = 0;

        for (const day of daysArray) {
            totalCount += day.total;
            vocabCount += day.vocab;
            sentenceCount += day.sentence;
        }

        // 计算连续打卡天数
        let currentStreak = 0;
        for (const day of daysArray) {
            if (day.total > 0) {
                currentStreak += 1;
            } else {
                break;
            }
        }

        return {
            days: daysArray,
            summary: {
                totalCount,
                vocabCount,
                sentenceCount,
                currentStreak,
            },
        };
    } catch (err) {
        console.error('[loadReviewStats] unexpected error:', err);
        return getEmptyStats(days);
    }
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 获取日期标签
 */
function getDayLabel(daysAgo) {
    if (daysAgo === 0) return '今天';
    if (daysAgo === 1) return '昨天';
    if (daysAgo === 2) return '前天';

    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * 返回空的统计数据
 */
function getEmptyStats(days) {
    const now = new Date();
    const daysArray = [];

    for (let i = 0; i < days; i++) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        daysArray.push({
            date: formatDateKey(date),
            label: getDayLabel(i),
            total: 0,
            vocab: 0,
            sentence: 0,
        });
    }

    return {
        days: daysArray,
        summary: {
            totalCount: 0,
            vocabCount: 0,
            sentenceCount: 0,
            currentStreak: 0,
        },
    };
}
