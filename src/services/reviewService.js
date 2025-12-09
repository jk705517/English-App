// src/services/reviewService.js
import { supabase } from './supabaseClient';

/**
 * 记录一次复习结果到 Supabase 日志表 user_review_logs
 * @param {Object} params
 * @param {'vocab'|'sentence'} params.itemType - 复习对象类型
 * @param {string} params.itemId - 该词/句子的唯一标识
 * @param {boolean} params.isKnown - true=我会了, false=还不熟
 * @param {string} [params.videoId] - 所属视频 id（可选）
 * @param {string} [params.notebookId] - 所属本子 id（可选）
 * @param {string} [params.reviewMode] - 复习模式，比如 'vocab_review' / 'sentence_review'
 * @param {string} userId - 当前用户 id
 */
export async function recordReviewLog({
    itemType,
    itemId,
    isKnown,
    videoId,
    notebookId,
    reviewMode,
}, userId) {
    try {
        if (!userId) {
            console.warn('[reviewService] no user, skip logging');
            return;
        }

        const { error } = await supabase.from('user_review_logs').insert({
            user_id: userId,
            item_type: itemType,
            item_id: String(itemId),
            video_id: videoId ? String(videoId) : null,
            notebook_id: notebookId ? String(notebookId) : null,
            is_known: !!isKnown,
            review_mode: reviewMode || null,
        });

        if (error) {
            console.error('[reviewService] insert user_review_logs error:', error);
        }
    } catch (err) {
        console.error('[reviewService] unexpected error:', err);
    }
}
