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

        // 1. 计算起始日期（days-1 天前的 00:00 本地时间）
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - (days - 1));
        startDate.setHours(0, 0, 0, 0);

        // 2. 查询 user_review_logs
        const { data: logs, error } = await supabase
            .from('user_review_logs')
            .select('item_type, created_at')
            .eq('user_id', user.id)
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[loadReviewStats] query error:', error);
            return getEmptyStats(days);
        }

        // 3. 按本地日期分组
        const dateMap = new Map(); // date string -> { total, vocab, sentence }

        for (const log of logs || []) {
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

        // 4. 生成最近 days 天的数据（包括没有记录的天）
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

        // 5. 计算汇总
        let totalCount = 0;
        let vocabCount = 0;
        let sentenceCount = 0;

        for (const day of daysArray) {
            totalCount += day.total;
            vocabCount += day.vocab;
            sentenceCount += day.sentence;
        }

        // 6. 计算连续打卡天数（从今天往前数）
        let currentStreak = 0;
        for (const day of daysArray) {
            if (day.total > 0) {
                currentStreak += 1;
            } else {
                break;
            }
        }

        const result = {
            days: daysArray,
            summary: {
                totalCount,
                vocabCount,
                sentenceCount,
                currentStreak,
            },
        };

        return result;
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
