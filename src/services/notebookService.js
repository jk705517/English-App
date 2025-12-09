import { supabase } from './supabaseClient';

/**
 * 按记忆状态拆分条目（纯函数，通用）
 * @param {Array} items - 条目列表（必须包含 id 或 item_id）
 * @param {Array} states - 复习状态列表（必须包含 item_id, next_review_at）
 * @param {Date} now - 当前时间
 * @returns {object} { due, fresh, future }
 */
function splitItemsByReviewState(items, states, now = new Date()) {
    const due = [];
    const fresh = [];
    const future = [];

    // Map states by item_id for O(1) lookup
    const stateMap = new Map();
    states.forEach(s => stateMap.set(String(s.item_id), s));

    items.forEach(item => {
        // 兼容处理：item 可能是 fullItem (有 id) 或 notebookItem (有 item_id)
        const itemId = String(item.id || item.item_id);
        const state = stateMap.get(itemId);

        if (!state) {
            fresh.push(item);
        } else {
            const nextReviewAt = state.next_review_at ? new Date(state.next_review_at) : null;
            if (nextReviewAt && nextReviewAt <= now) {
                due.push(item);
            } else {
                future.push(item);
            }
        }
    });

    return { due, fresh, future };
}

/**
 * 构建本子汇总信息
 * @param {Array} notebooks - 包含统计信息的本子列表
 */
function buildNotebooksSummary(notebooks) {
    const totalNotebooks = notebooks.length;

    let totalVocabCount = 0;
    let totalSentenceCount = 0;
    let totalDueVocabCount = 0;
    let totalDueSentenceCount = 0;

    // 找出第一个“有任务”的本子
    let firstDueNotebookId = null;
    let firstDueNotebookTab = null; // 'vocab' | 'sentence'

    for (const nb of notebooks) {
        const vocabCount = nb.vocabCount || 0;
        const sentenceCount = nb.sentenceCount || 0;
        const dueVocabCount = nb.dueVocabCount || 0;
        const dueSentenceCount = nb.dueSentenceCount || 0;

        totalVocabCount += vocabCount;
        totalSentenceCount += sentenceCount;
        totalDueVocabCount += dueVocabCount;
        totalDueSentenceCount += dueSentenceCount;

        if (!firstDueNotebookId && (dueVocabCount > 0 || dueSentenceCount > 0)) {
            firstDueNotebookId = nb.id;
            // 优先词汇；如果没有到期词，就用句子
            if (dueVocabCount > 0) {
                firstDueNotebookTab = 'vocab';
            } else {
                firstDueNotebookTab = 'sentence';
            }
        }
    }

    return {
        totalNotebooks,
        totalVocabCount,
        totalSentenceCount,
        totalDueVocabCount,
        totalDueSentenceCount,
        firstDueNotebookId,
        firstDueNotebookTab,
    };
}

/**
 * 加载用户的所有本子列表（按创建时间倒序）
 * @param {object} user - 当前登录用户
 * @returns {Promise<object>} { notebooks, summary }
 */
async function loadNotebooks(user) {
    if (!user) return { notebooks: [], summary: null };

    try {
        // 1. 获取用户的所有本子
        const { data: notebooksData, error: notebooksError } = await supabase
            .from('user_notebooks')
            .select('id, name, color, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (notebooksError) {
            console.error('Error loading notebooks:', notebooksError);
            return { notebooks: [], summary: null };
        }

        if (!notebooksData || notebooksData.length === 0) {
            return {
                notebooks: [],
                summary: buildNotebooksSummary([])
            };
        }

        // 2. 获取每个本子的条目统计
        const notebookIds = notebooksData.map(nb => nb.id);
        const { data: items, error: itemsError } = await supabase
            .from('user_notebook_items')
            .select('notebook_id, item_type, item_id')
            .eq('user_id', user.id)
            .in('notebook_id', notebookIds);

        if (itemsError) {
            console.error('Error loading notebook items for stats:', itemsError);
            // 即使统计失败，也返回本子列表（只是没有统计数据）
            const notebooks = notebooksData.map(nb => ({
                ...nb,
                sentenceCount: 0,
                vocabCount: 0,
                dueVocabCount: 0,
                dueSentenceCount: 0,
                hasVocabReviewState: false,
                hasSentenceReviewState: false
            }));
            return { notebooks, summary: buildNotebooksSummary(notebooks) };
        }

        // 3. 计算每个本子的句子/词汇数量，并收集所有 ID
        const statsMap = {};
        const allVocabIds = [];
        const allSentenceIds = [];

        for (const item of items || []) {
            if (!statsMap[item.notebook_id]) {
                statsMap[item.notebook_id] = { sentenceCount: 0, vocabCount: 0, dueVocabCount: 0, dueSentenceCount: 0 };
            }
            if (item.item_type === 'sentence') {
                statsMap[item.notebook_id].sentenceCount++;
                allSentenceIds.push(item.item_id);
            } else if (item.item_type === 'vocab') {
                statsMap[item.notebook_id].vocabCount++;
                allVocabIds.push(item.item_id);
            }
        }

        // 4. 获取所有相关的 review states (vocab & sentence)
        const allItemIds = [...allVocabIds, ...allSentenceIds];

        if (allItemIds.length > 0) {
            const { data: allStates, error: statesError } = await supabase
                .from('user_review_states')
                .select('item_id, item_type, next_review_at')
                .eq('user_id', user.id)
                .in('item_id', allItemIds);

            if (!statesError && allStates) {
                const now = new Date();

                // 按 notebook 分组计算
                for (const notebookId of notebookIds) {
                    // Vocab stats
                    const notebookVocabItems = (items || []).filter(
                        item => item.notebook_id === notebookId && item.item_type === 'vocab'
                    );
                    if (notebookVocabItems.length > 0) {
                        const vocabStates = allStates.filter(s => s.item_type === 'vocab');
                        const { due, fresh } = splitItemsByReviewState(notebookVocabItems, vocabStates, now);
                        if (statsMap[notebookId]) {
                            statsMap[notebookId].dueVocabCount = due.length;
                            // 如果 fresh 数量小于总数，说明有条目在 due 或 future 中，即有复习状态
                            statsMap[notebookId].hasVocabReviewState = fresh.length < notebookVocabItems.length;
                        }
                    }

                    // Sentence stats
                    const notebookSentenceItems = (items || []).filter(
                        item => item.notebook_id === notebookId && item.item_type === 'sentence'
                    );
                    if (notebookSentenceItems.length > 0) {
                        const sentenceStates = allStates.filter(s => s.item_type === 'sentence');
                        const { due, fresh } = splitItemsByReviewState(notebookSentenceItems, sentenceStates, now);
                        if (statsMap[notebookId]) {
                            statsMap[notebookId].dueSentenceCount = due.length;
                            // 如果 fresh 数量小于总数，说明有条目在 due 或 future 中，即有复习状态
                            statsMap[notebookId].hasSentenceReviewState = fresh.length < notebookSentenceItems.length;
                        }
                    }
                }
            } else if (statesError) {
                console.error('Error loading review states:', statesError);
            }
        }

        // 调试日志
        console.log('[NotebookList] stats', notebooksData.map(n => ({
            id: n.id,
            name: n.name,
            vocabTotal: statsMap[n.id]?.vocabCount || 0,
            vocabDue: statsMap[n.id]?.dueVocabCount || 0,
            sentenceTotal: statsMap[n.id]?.sentenceCount || 0,
            sentenceDue: statsMap[n.id]?.dueSentenceCount || 0,
        })));

        // 5. 合并统计数据到本子列表
        const notebooks = notebooksData.map(nb => ({
            ...nb,
            sentenceCount: statsMap[nb.id]?.sentenceCount || 0,
            vocabCount: statsMap[nb.id]?.vocabCount || 0,
            dueVocabCount: statsMap[nb.id]?.dueVocabCount || 0,
            dueSentenceCount: statsMap[nb.id]?.dueSentenceCount || 0,
            hasVocabReviewState: statsMap[nb.id]?.hasVocabReviewState || false,
            hasSentenceReviewState: statsMap[nb.id]?.hasSentenceReviewState || false
        }));

        const summary = buildNotebooksSummary(notebooks);
        console.log('[NotebooksSummary]', summary);

        return { notebooks, summary };
    } catch (error) {
        console.error('Error in loadNotebooks:', error);
        return { notebooks: [], summary: null };
    }
}

/**
 * 创建新本子
 * @param {object} user - 当前登录用户
 * @param {object} options - { name: string, color?: string }
 * @returns {Promise<object|null>} 新创建的本子对象
 */
async function createNotebook(user, { name, color = null }) {
    if (!user || !name) return null;

    try {
        const { data, error } = await supabase
            .from('user_notebooks')
            .insert({
                user_id: user.id,
                name: name.trim(),
                color
            })
            .select('id, name, color, created_at')
            .single();

        if (error) {
            console.error('Error creating notebook:', error);
            return null;
        }

        return {
            ...data,
            sentenceCount: 0,
            vocabCount: 0
        };
    } catch (error) {
        console.error('Error in createNotebook:', error);
        return null;
    }
}

/**
 * 重命名本子
 * @param {object} user - 当前登录用户
 * @param {number} notebookId - 本子 ID
 * @param {string} newName - 新名称
 * @returns {Promise<boolean>} 是否成功
 */
async function renameNotebook(user, notebookId, newName) {
    if (!user || !notebookId || !newName) return false;

    try {
        const { error } = await supabase
            .from('user_notebooks')
            .update({ name: newName.trim() })
            .eq('id', notebookId)
            .eq('user_id', user.id);

        if (error) {
            console.error('Error renaming notebook:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error in renameNotebook:', error);
        return false;
    }
}

/**
 * 删除本子（条目会通过外键级联删除）
 * @param {object} user - 当前登录用户
 * @param {number} notebookId - 本子 ID
 * @returns {Promise<boolean>} 是否成功
 */
async function deleteNotebook(user, notebookId) {
    if (!user || !notebookId) return false;

    try {
        const { error } = await supabase
            .from('user_notebooks')
            .delete()
            .eq('id', notebookId)
            .eq('user_id', user.id);

        if (error) {
            console.error('Error deleting notebook:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error in deleteNotebook:', error);
        return false;
    }
}

/**
 * 向本子里添加条目（句子或词汇）
 * @param {object} user - 当前登录用户
 * @param {object} options - { notebookId, itemType, itemId, videoId }
 * @returns {Promise<boolean>} 是否成功
 */
async function addItemToNotebook(user, { notebookId, itemType, itemId, videoId }) {
    if (!user || !notebookId || !itemType || !itemId || !videoId) return false;

    try {
        const { error } = await supabase
            .from('user_notebook_items')
            .insert({
                user_id: user.id,
                notebook_id: notebookId,
                item_type: itemType,
                item_id: itemId,
                video_id: videoId
            });

        if (error) {
            // 如果是唯一约束冲突（重复添加），静默处理为成功
            if (error.code === '23505') {
                console.log('Item already exists in notebook, treating as success');
                return true;
            }
            console.error('Error adding item to notebook:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error in addItemToNotebook:', error);
        return false;
    }
}

/**
 * 从本子里移除条目
 * @param {object} user - 当前登录用户
 * @param {object} options - { notebookId, itemType, itemId }
 * @returns {Promise<boolean>} 是否成功
 */
async function removeItemFromNotebook(user, { notebookId, itemType, itemId }) {
    if (!user || !notebookId || !itemType || !itemId) return false;

    try {
        const { error } = await supabase
            .from('user_notebook_items')
            .delete()
            .eq('user_id', user.id)
            .eq('notebook_id', notebookId)
            .eq('item_type', itemType)
            .eq('item_id', itemId);

        if (error) {
            console.error('Error removing item from notebook:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error in removeItemFromNotebook:', error);
        return false;
    }
}

/**
 * 加载某个本子的详情（含句子和词汇列表）
 * @param {object} user - 当前登录用户
 * @param {number} notebookId - 本子 ID
 * @returns {Promise<object|null>} { notebook, sentences, vocabs }
 */
async function loadNotebookDetail(user, notebookId) {
    if (!user || !notebookId) return null;

    try {
        // 1. 获取本子基本信息
        const { data: notebook, error: notebookError } = await supabase
            .from('user_notebooks')
            .select('id, name, color, created_at')
            .eq('id', notebookId)
            .eq('user_id', user.id)
            .single();

        if (notebookError || !notebook) {
            console.error('Error loading notebook:', notebookError);
            return null;
        }

        // 2. 获取本子里的所有条目
        const { data: items, error: itemsError } = await supabase
            .from('user_notebook_items')
            .select('item_type, item_id, video_id')
            .eq('notebook_id', notebookId)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (itemsError) {
            console.error('Error loading notebook items:', itemsError);
            return { notebook, sentences: [], vocabs: [] };
        }

        if (!items || items.length === 0) {
            return { notebook, sentences: [], vocabs: [] };
        }

        // 3. 获取所有相关的视频信息
        const videoIds = [...new Set(items.map(item => item.video_id).filter(Boolean))];
        if (videoIds.length === 0) {
            return { notebook, sentences: [], vocabs: [] };
        }

        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('id, title, episode, transcript, vocab')
            .in('id', videoIds);

        if (videosError) {
            console.error('Error loading videos:', videosError);
            return { notebook, sentences: [], vocabs: [] };
        }

        // 4. 匹配句子详情
        const sentences = [];
        const sentenceItems = items.filter(item => item.item_type === 'sentence');
        for (const item of sentenceItems) {
            const video = videos?.find(v => v.id === item.video_id);
            if (!video?.transcript) continue;

            const sentence = video.transcript.find(t => t.id === item.item_id);
            if (sentence) {
                sentences.push({
                    sentenceId: item.item_id,
                    videoId: item.video_id,
                    en: sentence.text || sentence.en,
                    cn: sentence.cn,
                    start: sentence.start,
                    episode: video.episode,
                    title: video.title
                });
            }
        }

        // 5. 匹配词汇详情
        const vocabs = [];
        const vocabItems = items.filter(item => item.item_type === 'vocab');
        for (const item of vocabItems) {
            const video = videos?.find(v => v.id === item.video_id);
            if (!video?.vocab) continue;

            const vocabItem = video.vocab.find(v => v.id === item.item_id);
            if (vocabItem) {
                vocabs.push({
                    vocabId: item.item_id,
                    videoId: item.video_id,
                    word: vocabItem.word,
                    phonetic: vocabItem.ipa_us || vocabItem.phonetic,
                    meaning: vocabItem.meaning,
                    episode: video.episode,
                    title: video.title
                });
            }
        }

        return { notebook, sentences, vocabs };
    } catch (error) {
        console.error('Error in loadNotebookDetail:', error);
        return null;
    }
}
/**
 * 加载本子中的词汇（用于复习模式，包含完整词汇信息）
 * v2: 按记忆曲线选题
 *   - 优先返回"到期的词"（next_review_at <= now）
 *   - 如果到期的不够 20 个，再补充一些"新词"（从未有状态）
 * 
 * @param {object} user - 当前登录用户
 * @param {number} notebookId - 本子 ID
 * @returns {Promise<object|null>} { notebook, vocabs, totalVocabCount }
 */
async function loadNotebookVocabsForReview(user, notebookId) {
    if (!user || !notebookId) return null;

    const MAX_PER_SESSION = 20;

    try {
        // 1. 获取本子基本信息
        const { data: notebook, error: notebookError } = await supabase
            .from('user_notebooks')
            .select('id, name, color, created_at')
            .eq('id', notebookId)
            .eq('user_id', user.id)
            .single();

        if (notebookError || !notebook) {
            console.error('Error loading notebook:', notebookError);
            return null;
        }

        // 2. 获取本子里的词汇条目（按添加时间升序）
        const { data: items, error: itemsError } = await supabase
            .from('user_notebook_items')
            .select('item_type, item_id, video_id, created_at')
            .eq('notebook_id', notebookId)
            .eq('user_id', user.id)
            .eq('item_type', 'vocab')
            .order('created_at', { ascending: true });

        if (itemsError) {
            console.error('Error loading notebook vocab items:', itemsError);
            return { notebook, vocabs: [], totalVocabCount: 0 };
        }

        if (!items || items.length === 0) {
            console.log('[loadNotebookVocabsForReview] No vocab items in notebook');
            return { notebook, vocabs: [], totalVocabCount: 0 };
        }

        console.log('[loadNotebookVocabsForReview] Found notebook items:', items.length);

        // 3. 获取所有相关的视频信息（包含词汇数据）
        const videoIds = [...new Set(items.map(item => item.video_id).filter(Boolean))];
        if (videoIds.length === 0) {
            console.log('[loadNotebookVocabsForReview] No video IDs found');
            return { notebook, vocabs: [], totalVocabCount: 0 };
        }

        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('id, title, episode, vocab')
            .in('id', videoIds);

        if (videosError) {
            console.error('Error loading videos:', videosError);
            return { notebook, vocabs: [], totalVocabCount: 0 };
        }

        // 4. 构建 fullVocabs 数组（匹配词汇详情）
        const fullVocabs = [];
        for (const item of items) {
            const video = videos?.find(v => v.id === item.video_id);
            if (!video?.vocab) {
                console.warn('[loadNotebookVocabsForReview] Video or vocab not found for item:', item);
                continue;
            }

            // 尝试多种匹配方式
            const vocabItem = video.vocab.find(v =>
                v.id === item.item_id ||
                String(v.id) === String(item.item_id)
            );

            if (vocabItem) {
                fullVocabs.push({
                    id: item.item_id,
                    word: vocabItem.word,
                    type: vocabItem.type,
                    ipa_us: vocabItem.ipa_us,
                    ipa_uk: vocabItem.ipa_uk,
                    meaning: vocabItem.meaning,
                    examples: vocabItem.examples || [],
                    collocations: vocabItem.collocations || [],
                    videoId: item.video_id,
                    episode: video.episode,
                    title: video.title
                });
            } else {
                console.warn('[loadNotebookVocabsForReview] Vocab item not found in video:', {
                    item_id: item.item_id,
                    video_id: item.video_id,
                    available_vocab_ids: video.vocab.slice(0, 5).map(v => v.id)
                });
            }
        }

        if (fullVocabs.length === 0) {
            console.log('[loadNotebookVocabsForReview] No vocabs matched from videos');
            return { notebook, vocabs: [], totalVocabCount: 0 };
        }

        // 5. 查询 user_review_states，获取这些词汇的复习状态
        const itemIds = fullVocabs.map(v => String(v.id));
        const { data: states, error: statesError } = await supabase
            .from('user_review_states')
            .select('item_id, next_review_at, familiarity_level')
            .eq('user_id', user.id)
            .eq('item_type', 'vocab')
            .in('item_id', itemIds);

        if (statesError) {
            console.error('Error loading review states:', statesError);
            // 出错时回退到返回所有词汇
            return { notebook, vocabs: fullVocabs, totalVocabCount: fullVocabs.length };
        }

        // 6. 使用统一工具函数拆分状态
        const now = new Date();
        const { due, fresh, future } = splitItemsByReviewState(fullVocabs, states, now);

        // 7. 对到期词按 next_review_at 升序排序
        const stateByItemId = new Map();
        for (const s of (states || [])) {
            stateByItemId.set(String(s.item_id), s);
        }

        const dueWithState = due.map(v => ({
            vocab: v,
            state: stateByItemId.get(String(v.id))
        }));

        dueWithState.sort((a, b) => {
            const t1 = a.state?.next_review_at ? new Date(a.state.next_review_at).getTime() : 0;
            const t2 = b.state?.next_review_at ? new Date(b.state.next_review_at).getTime() : 0;
            return t1 - t2;
        });

        // 8. 组合本轮复习列表
        let selectedVocabs;
        if (dueWithState.length >= MAX_PER_SESSION) {
            // 到期词够多，只取前 20 个
            selectedVocabs = dueWithState.slice(0, MAX_PER_SESSION).map(x => x.vocab);
        } else {
            // 到期词不够，用新词补足
            const needFresh = MAX_PER_SESSION - dueWithState.length;
            selectedVocabs = [
                ...dueWithState.map(x => x.vocab),
                ...fresh.slice(0, needFresh),
            ];
        }

        // 9. 兜底：如果 fullVocabs 有内容但 selectedVocabs 还是空，至少给一轮
        if (fullVocabs.length > 0 && selectedVocabs.length === 0) {
            console.warn('[loadNotebookVocabsForReview] Fallback: selectedVocabs empty but fullVocabs has items');
            selectedVocabs = fullVocabs.slice(0, MAX_PER_SESSION);
        }

        // 调试日志
        console.log('[ReviewDetail] notebook', notebookId, {
            total: fullVocabs.length,
            due: due.length,
            fresh: fresh.length,
            selected: selectedVocabs.length,
        });

        return { notebook, vocabs: selectedVocabs, totalVocabCount: fullVocabs.length, dueCount: due.length };
    } catch (error) {
        console.error('Error in loadNotebookVocabsForReview:', error);
        return null;
    }
}


/**
 * v1.3: 加载某个词汇在原视频中的字幕句子
 * @param {object} user - 当前登录用户
 * @param {object} vocabItem - 词汇对象，必须包含 videoId 和 word
 * @returns {Promise<Array>} 句子列表 [{ id, videoId, index, en, cn, startTime }]
 */
async function loadSentencesForVocab(user, vocabItem) {
    if (!user || !vocabItem || !vocabItem.videoId) {
        return [];
    }

    try {
        // 1. 获取视频的字幕数据
        const { data: video, error: videoError } = await supabase
            .from('videos')
            .select('id, transcript')
            .eq('id', vocabItem.videoId)
            .single();

        if (videoError || !video || !video.transcript) {
            console.error('Error loading video transcript:', videoError);
            return [];
        }

        // 2. 在字幕中查找包含该单词的句子
        const word = vocabItem.word?.toLowerCase();
        if (!word) return [];

        const transcript = video.transcript;
        const matchingSentences = [];

        for (let i = 0; i < transcript.length; i++) {
            const sentence = transcript[i];
            const text = sentence.text || sentence.en || '';

            // 简单的单词匹配：检查单词是否出现在句子中（忽略大小写）
            // 使用单词边界匹配，避免部分匹配（如 "the" 匹配 "there"）
            const wordRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

            if (wordRegex.test(text)) {
                matchingSentences.push({
                    id: sentence.id || `${vocabItem.videoId}-${i}`,
                    videoId: vocabItem.videoId,
                    index: i,
                    en: text,
                    cn: sentence.cn || sentence.translation || '',
                    startTime: sentence.start || 0
                });
            }
        }

        // 3. 按时间/序号排序，最多返回 3 条
        matchingSentences.sort((a, b) => a.index - b.index);
        return matchingSentences.slice(0, 3);

    } catch (error) {
        console.error('Error in loadSentencesForVocab:', error);
        return [];
    }
}

/**
 * 句子复习模式：加载本子中的句子（包含完整句子信息）
 * v2: 接入记忆曲线
 * @param {object} user - 当前登录用户
 * @param {number} notebookId - 本子 ID
 * @returns {Promise<object|null>} { notebook, sentences, totalSentenceCount, dueSentenceCount }
 */
async function loadNotebookSentencesForReview(user, notebookId) {
    if (!user || !notebookId) return null;

    const MAX_PER_SESSION = 50; // 句子复习上限可以稍微多一点，或者保持一致

    try {
        // 1. 获取本子基本信息
        const { data: notebook, error: notebookError } = await supabase
            .from('user_notebooks')
            .select('id, name, color, created_at')
            .eq('id', notebookId)
            .eq('user_id', user.id)
            .single();

        if (notebookError || !notebook) {
            console.error('Error loading notebook:', notebookError);
            return null;
        }

        // 2. 获取本子里的句子条目（按添加时间升序）
        const { data: items, error: itemsError } = await supabase
            .from('user_notebook_items')
            .select('item_type, item_id, video_id, created_at')
            .eq('notebook_id', notebookId)
            .eq('user_id', user.id)
            .eq('item_type', 'sentence')
            .order('created_at', { ascending: true });

        if (itemsError) {
            console.error('Error loading notebook sentence items:', itemsError);
            return { notebook, sentences: [], totalSentenceCount: 0, dueSentenceCount: 0 };
        }

        if (!items || items.length === 0) {
            return { notebook, sentences: [], totalSentenceCount: 0, dueSentenceCount: 0 };
        }

        // 3. 获取所有相关的视频信息（包含字幕数据）
        const videoIds = [...new Set(items.map(item => item.video_id).filter(Boolean))];
        if (videoIds.length === 0) {
            return { notebook, sentences: [], totalSentenceCount: 0, dueSentenceCount: 0 };
        }

        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('id, title, episode, transcript')
            .in('id', videoIds);

        if (videosError) {
            console.error('Error loading videos:', videosError);
            return { notebook, sentences: [], totalSentenceCount: 0, dueSentenceCount: 0 };
        }

        // 4. 匹配句子详情（从 transcript 中查找）
        const fullSentences = [];
        for (const item of items) {
            const video = videos?.find(v => v.id === item.video_id);
            if (!video?.transcript) continue;

            // item_id 是句子的 id（可能是数字或字符串）
            const sentenceItem = video.transcript.find(s =>
                s.id === item.item_id ||
                String(s.id) === String(item.item_id)
            );

            if (sentenceItem) {
                const index = video.transcript.indexOf(sentenceItem);
                fullSentences.push({
                    id: item.item_id,
                    videoId: item.video_id,
                    index: index >= 0 ? index : 0,
                    startTime: sentenceItem.start || 0,
                    en: sentenceItem.text || sentenceItem.en || '',
                    cn: sentenceItem.cn || sentenceItem.translation || '',
                    episode: video.episode,
                    title: video.title
                });
            }
        }

        // 5. 查询 user_review_states
        const itemIds = fullSentences.map(s => String(s.id));
        const { data: states, error: statesError } = await supabase
            .from('user_review_states')
            .select('item_id, next_review_at, familiarity_level')
            .eq('user_id', user.id)
            .eq('item_type', 'sentence')
            .in('item_id', itemIds);

        if (statesError) {
            console.error('Error loading review states for sentences:', statesError);
            // 出错时回退到返回所有
            return {
                notebook,
                sentences: fullSentences,
                totalSentenceCount: fullSentences.length,
                dueSentenceCount: fullSentences.length
            };
        }

        // 6. 拆分状态
        const now = new Date();
        const { due, fresh, future } = splitItemsByReviewState(fullSentences, states, now);

        // 7. 对到期句子按 next_review_at 升序排序
        const stateByItemId = new Map();
        for (const s of (states || [])) {
            stateByItemId.set(String(s.item_id), s);
        }

        const dueWithState = due.map(s => ({
            sentence: s,
            state: stateByItemId.get(String(s.id))
        }));

        dueWithState.sort((a, b) => {
            const t1 = a.state?.next_review_at ? new Date(a.state.next_review_at).getTime() : 0;
            const t2 = b.state?.next_review_at ? new Date(b.state.next_review_at).getTime() : 0;
            return t1 - t2;
        });

        // 8. 决定本轮返回哪些句子
        let selectedSentences;
        if (dueWithState.length > 0) {
            // 有到期的，优先复习到期的（可加 limit）
            selectedSentences = dueWithState.slice(0, MAX_PER_SESSION).map(x => x.sentence);
        } else if (fullSentences.length > 0) {
            // 没有到期的，但本子不为空 -> "随便练一练"
            // 可以返回全部，或者随机取一些，这里先返回全部（受 MAX_PER_SESSION 限制）
            selectedSentences = fullSentences.slice(0, MAX_PER_SESSION);
        } else {
            selectedSentences = [];
        }

        // 调试输出
        console.log('[SentenceReviewDetail]', {
            notebookId,
            total: fullSentences.length,
            due: due.length,
            fresh: fresh.length,
        });

        return {
            notebook,
            sentences: selectedSentences,
            totalSentenceCount: fullSentences.length,
            dueSentenceCount: due.length
        };

    } catch (error) {
        console.error('Error in loadNotebookSentencesForReview:', error);
        return null;
    }
}

export const notebookService = {
    loadNotebooks,
    createNotebook,
    renameNotebook,
    deleteNotebook,
    addItemToNotebook,
    removeItemFromNotebook,
    loadNotebookDetail,
    loadNotebookVocabsForReview,
    loadSentencesForVocab,
    loadNotebookSentencesForReview
};
