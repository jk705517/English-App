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

// ========== 记忆曲线 v1 ==========

/**
 * 熟练度等级对应的复习间隔（小时）
 */
const INTERVAL_HOURS_BY_LEVEL = {
    0: 12,   // 12 小时后
    1: 24,   // 1 天后
    2: 72,   // 3 天后
    3: 168,  // 7 天后（封顶）
};

/**
 * 根据熟练度等级计算下次复习时间
 * @param {number} level - 熟练度等级 (0-3)
 * @returns {string} ISO 格式的时间戳
 */
function getNextReviewAtFromLevel(level) {
    const hours = INTERVAL_HOURS_BY_LEVEL[level] ?? 24;
    const now = new Date();
    return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}

/**
 * 根据本次复习结果，更新 user_review_states
 * 目前只对 item_type='vocab' 生效
 * 
 * v2 规则：
 * - isKnown=true: level+1（最高3），间隔按 level 计算
 * - isKnown=false: level-1（最低0），next_review_at=now（立即到期，下轮优先出现）
 * 
 * @param {Object} params
 * @param {'vocab'|'sentence'} params.itemType - 复习对象类型
 * @param {string} params.itemId - 该词/句子的唯一标识
 * @param {boolean} params.isKnown - true=我会了, false=还不熟
 * @param {string} [params.videoId] - 所属视频 id（可选）
 * @param {string} [params.notebookId] - 所属本子 id（可选）
 * @param {string} userId - 当前用户 id
 */
export async function updateReviewState({
    itemType,
    itemId,
    isKnown,
    videoId,
    notebookId,
}, userId) {
    // 现在对 vocab 和 sentence 都做记忆曲线
    // if (itemType !== 'vocab') {
    //     return;
    // }

    try {
        if (!userId) {
            console.warn('[updateReviewState] no user, skip');
            return;
        }

        const nowIso = new Date().toISOString();

        // 1. 查询现有状态
        const { data: existing, error: fetchError } = await supabase
            .from('user_review_states')
            .select('*')
            .eq('user_id', userId)
            .eq('item_type', itemType)
            .eq('item_id', String(itemId))
            .maybeSingle();

        if (fetchError) {
            console.error('[updateReviewState] fetch error:', fetchError);
            return;
        }

        let payload;

        if (!existing) {
            // ========== 首次创建 ==========
            let level;
            let nextReviewAt;
            let successStreak;

            if (isKnown) {
                // 答对：level=1，按 level 算间隔
                level = 1;
                successStreak = 1;
                nextReviewAt = getNextReviewAtFromLevel(level);
            } else {
                // 答错：level=0，next_review_at=now（立即到期）
                level = 0;
                successStreak = 0;
                nextReviewAt = nowIso;
            }

            payload = {
                user_id: userId,
                item_type: itemType,
                item_id: String(itemId),
                video_id: videoId ? String(videoId) : null,
                notebook_id: notebookId ? String(notebookId) : null,
                review_count: 1,
                familiarity_level: level,
                success_streak: successStreak,
                last_result_known: isKnown,
                last_review_at: nowIso,
                next_review_at: nextReviewAt,
                updated_at: nowIso,
            };

            const { error: insertError } = await supabase
                .from('user_review_states')
                .insert(payload);

            if (insertError) {
                console.error('[updateReviewState] insert error:', insertError);
            }
        } else {
            // ========== 更新已有状态 ==========
            let level = existing.familiarity_level ?? 0;
            let successStreak = existing.success_streak ?? 0;
            const reviewCount = (existing.review_count ?? 0) + 1;
            let nextReviewAt;

            if (isKnown) {
                // 答对：level+1（最高3），successStreak+1
                level = Math.min(3, level + 1);
                successStreak += 1;
                nextReviewAt = getNextReviewAtFromLevel(level);
            } else {
                // 答错：level-1（最低0），successStreak清零，next_review_at=now
                level = Math.max(0, level - 1);
                successStreak = 0;
                nextReviewAt = nowIso; // 关键：立即到期，下轮优先出现
            }

            payload = {
                review_count: reviewCount,
                familiarity_level: level,
                success_streak: successStreak,
                last_result_known: isKnown,
                last_review_at: nowIso,
                next_review_at: nextReviewAt,
                updated_at: nowIso,
                // 顺便更新 video_id / notebook_id（如有变化）
                video_id: videoId ? String(videoId) : existing.video_id,
                notebook_id: notebookId ? String(notebookId) : existing.notebook_id,
            };

            const { error: updateError } = await supabase
                .from('user_review_states')
                .update(payload)
                .eq('id', existing.id);

            if (updateError) {
                console.error('[updateReviewState] update error:', updateError);
            }
        }
    } catch (err) {
        console.error('[updateReviewState] unexpected error:', err);
    }
}
