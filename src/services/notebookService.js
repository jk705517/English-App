import { notebooksAPI } from './api';
import { supabase } from './supabaseClient';

// ============================================
// 基础 API 封装函数
// ============================================

// 获取用户所有笔记本（基础版本）
export const getUserNotebooks = async (userId) => {
    try {
        const response = await notebooksAPI.getAll();
        return response.success ? response.data : [];
    } catch (error) {
        console.error('获取笔记本失败:', error);
        return [];
    }
};

// 创建笔记本（基础版本）
export const createNotebook = async (userId, name, color = '#3B82F6') => {
    try {
        const response = await notebooksAPI.create(name, color);
        return response.success ? response.data : null;
    } catch (error) {
        console.error('创建笔记本失败:', error);
        return null;
    }
};

// 删除笔记本（基础版本）
export const deleteNotebook = async (notebookId) => {
    try {
        const response = await notebooksAPI.delete(notebookId);
        return response.success;
    } catch (error) {
        console.error('删除笔记本失败:', error);
        return false;
    }
};

// 获取笔记本内容
export const getNotebookItems = async (notebookId) => {
    try {
        const response = await notebooksAPI.getItems(notebookId);
        return response.success ? response.data : [];
    } catch (error) {
        console.error('获取笔记本内容失败:', error);
        return [];
    }
};

// 添加内容到笔记本（基础版本）
export const addToNotebook = async (userId, notebookId, itemType, itemId, videoId) => {
    try {
        const response = await notebooksAPI.addItem(notebookId, itemType, itemId, videoId);
        return response.success ? response.data : null;
    } catch (error) {
        console.error('添加到笔记本失败:', error);
        return null;
    }
};

// 从笔记本删除内容（基础版本）
export const removeFromNotebook = async (notebookId, itemId) => {
    try {
        const response = await notebooksAPI.deleteItem(notebookId, itemId);
        return response.success;
    } catch (error) {
        console.error('从笔记本删除失败:', error);
        return false;
    }
};

// ============================================
// 兼容层：与原有代码保持一致的 notebookService 对象
// ============================================

export const notebookService = {
    /**
     * 加载用户所有笔记本（带统计信息）
     * @param {Object} user - 用户对象
     * @returns {Promise<{notebooks: Array, summary: Object}>}
     */
    loadNotebooks: async (user) => {
        if (!user) return { notebooks: [], summary: null };

        try {
            const response = await notebooksAPI.getAll();
            console.log('📚 loadNotebooks - API response:', response);

            if (!response.success) {
                console.warn('📚 loadNotebooks - API returned success:false');
                return { notebooks: [], summary: null };
            }

            const rawNotebooks = response.data || [];
            console.log('📚 loadNotebooks - raw notebooks from API:', rawNotebooks);

            // 规范化字段名（支持 snake_case 和 camelCase）
            const notebooks = rawNotebooks.map(nb => ({
                ...nb,
                vocabCount: nb.vocabCount ?? nb.vocab_count ?? 0,
                sentenceCount: nb.sentenceCount ?? nb.sentence_count ?? 0,
                dueVocabCount: nb.dueVocabCount ?? nb.due_vocab_count ?? 0,
                dueSentenceCount: nb.dueSentenceCount ?? nb.due_sentence_count ?? 0,
                hasVocabReviewState: nb.hasVocabReviewState ?? nb.has_vocab_review_state ?? false,
                hasSentenceReviewState: nb.hasSentenceReviewState ?? nb.has_sentence_review_state ?? false,
            }));

            console.log('📚 loadNotebooks - normalized notebooks:', notebooks);
            console.log('📚 loadNotebooks - notebooks.length:', notebooks.length);

            // 计算汇总数据
            let totalVocabCount = 0;
            let totalSentenceCount = 0;
            let totalDueVocabCount = 0;
            let totalDueSentenceCount = 0;
            let firstDueNotebookId = null;
            let firstDueNotebookTab = null;

            notebooks.forEach((nb, i) => {
                console.log(`📚 loadNotebooks - notebook[${i}]:`, {
                    id: nb.id,
                    name: nb.name,
                    vocabCount: nb.vocabCount,
                    sentenceCount: nb.sentenceCount,
                    dueVocabCount: nb.dueVocabCount,
                    dueSentenceCount: nb.dueSentenceCount,
                });

                totalVocabCount += nb.vocabCount || 0;
                totalSentenceCount += nb.sentenceCount || 0;
                totalDueVocabCount += nb.dueVocabCount || 0;
                totalDueSentenceCount += nb.dueSentenceCount || 0;

                // 找到第一个有待复习任务的本子
                if (!firstDueNotebookId) {
                    if ((nb.dueVocabCount || 0) > 0) {
                        firstDueNotebookId = nb.id;
                        firstDueNotebookTab = 'vocab';
                    } else if ((nb.dueSentenceCount || 0) > 0) {
                        firstDueNotebookId = nb.id;
                        firstDueNotebookTab = 'sentence';
                    }
                }
            });

            const summary = {
                totalNotebooks: notebooks.length,
                totalVocabCount,
                totalSentenceCount,
                totalDueVocabCount,
                totalDueSentenceCount,
                firstDueNotebookId,
                firstDueNotebookTab,
            };

            console.log('📚 loadNotebooks - calculated summary:', summary);

            return { notebooks, summary };
        } catch (error) {
            console.error('加载笔记本列表失败:', error);
            return { notebooks: [], summary: null };
        }
    },

    /**
     * 加载笔记本详情（包括句子和词汇列表）
     * API 返回格式：{ success: true, data: [{ id, notebook_id, item_type, item_id, video_id, created_at }] }
     * 需要从 Supabase 获取视频数据来提取实际的句子/词汇内容
     * @param {Object} user - 用户对象
     * @param {string|number} notebookId - 笔记本ID
     * @returns {Promise<Object>}
     */
    loadNotebookDetail: async (user, notebookId) => {
        if (!user || !notebookId) return null;

        try {
            const response = await notebooksAPI.getItems(notebookId);
            console.log('📓 loadNotebookDetail - API response:', response);

            if (!response.success) {
                console.warn('📓 loadNotebookDetail - API returned success:false');
                return null;
            }

            // API 返回的是一个扁平数组
            const rawItems = Array.isArray(response.data) ? response.data : [];
            console.log('📓 loadNotebookDetail - rawItems:', rawItems);

            // 分离句子和词汇
            const sentenceItems = rawItems.filter(item => item.item_type === 'sentence');
            const vocabItems = rawItems.filter(item => item.item_type === 'vocab');
            console.log('📓 loadNotebookDetail - sentenceItems:', sentenceItems.length, 'vocabItems:', vocabItems.length);

            // 如果没有任何项目，直接返回
            if (rawItems.length === 0) {
                return {
                    notebook: { id: notebookId, name: '', color: '#3B82F6' },
                    sentences: [],
                    vocabs: [],
                };
            }

            // 收集所有需要获取的视频 ID
            const videoIds = [...new Set(rawItems.map(item => item.video_id).filter(Boolean))];
            console.log('📓 loadNotebookDetail - videoIds to fetch:', videoIds);

            // 从 Supabase 获取视频数据
            let videoMap = {};
            if (videoIds.length > 0) {
                const { data: videos, error } = await supabase
                    .from('videos')
                    .select('id, title, episode, transcript, vocab')
                    .in('id', videoIds);

                if (error) {
                    console.error('📓 loadNotebookDetail - Supabase error:', error);
                } else {
                    videos.forEach(v => { videoMap[v.id] = v; });
                    console.log('📓 loadNotebookDetail - fetched videos:', videos.length);
                }
            }

            // 丰富句子数据
            const enrichedSentences = sentenceItems.map(item => {
                const video = videoMap[item.video_id];
                if (!video || !video.transcript) {
                    return {
                        sentenceId: item.item_id,
                        videoId: item.video_id,
                        en: '',
                        cn: '',
                        episode: 0,
                        title: '',
                    };
                }

                // 查找句子：优先按 id 匹配，其次按索引
                const itemId = item.item_id;
                let sentence = null;

                // 尝试按 id 匹配
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
                    sentenceId: item.item_id,
                    videoId: item.video_id,
                    en: sentence?.text || sentence?.en || '',
                    cn: sentence?.cn || '',
                    episode: video.episode || 0,
                    title: video.title || '',
                };
            }).filter(s => s.en || s.cn); // 过滤掉找不到内容的

            // 丰富词汇数据
            const enrichedVocabs = vocabItems.map(item => {
                const video = videoMap[item.video_id];
                if (!video || !video.vocab) {
                    return {
                        vocabId: item.item_id,
                        videoId: item.video_id,
                        word: '',
                        meaning: '',
                        phonetic: '',
                        episode: 0,
                        title: '',
                    };
                }

                // 查找词汇：按 id 匹配
                const itemId = item.item_id;
                let vocabItem = video.vocab.find(v => v.id === itemId || String(v.id) === String(itemId));

                // 如果没找到，尝试按数字索引
                if (!vocabItem && typeof itemId === 'number' && video.vocab[itemId]) {
                    vocabItem = video.vocab[itemId];
                }

                return {
                    vocabId: item.item_id,
                    videoId: item.video_id,
                    word: vocabItem?.word || '',
                    meaning: vocabItem?.meaning || '',
                    phonetic: vocabItem?.ipa_us || vocabItem?.phonetic || '',
                    episode: video.episode || 0,
                    title: video.title || '',
                };
            }).filter(v => v.word); // 过滤掉找不到内容的

            console.log('📓 loadNotebookDetail - enrichedSentences:', enrichedSentences.length);
            console.log('📓 loadNotebookDetail - enrichedVocabs:', enrichedVocabs.length);

            return {
                notebook: { id: notebookId, name: '', color: '#3B82F6' },
                sentences: enrichedSentences,
                vocabs: enrichedVocabs,
            };
        } catch (error) {
            console.error('加载笔记本详情失败:', error);
            return null;
        }
    },

    /**
     * 加载笔记本中的词汇复习数据
     * API 返回格式：{ success: true, data: [{ id, notebook_id, item_type, item_id, video_id, created_at }] }
     * @param {Object} user - 用户对象
     * @param {string|number} notebookId - 笔记本ID
     * @returns {Promise<Object>}
     */
    loadNotebookVocabsForReview: async (user, notebookId) => {
        if (!user || !notebookId) return null;

        try {
            const response = await notebooksAPI.getItems(notebookId);
            if (!response.success) {
                return null;
            }

            // API 返回的是一个扁平数组
            const rawItems = Array.isArray(response.data) ? response.data : [];
            const vocabItems = rawItems.filter(item => item.item_type === 'vocab');

            if (vocabItems.length === 0) {
                return {
                    notebook: { id: notebookId, name: '' },
                    vocabs: [],
                    totalVocabCount: 0,
                    dueCount: 0,
                };
            }

            // 从 Supabase 获取视频数据
            const videoIds = [...new Set(vocabItems.map(item => item.video_id).filter(Boolean))];
            let videoMap = {};
            if (videoIds.length > 0) {
                const { data: videos, error } = await supabase
                    .from('videos')
                    .select('id, title, episode, vocab')
                    .in('id', videoIds);

                if (!error && videos) {
                    videos.forEach(v => { videoMap[v.id] = v; });
                }
            }

            // 丰富词汇数据
            const enrichedVocabs = vocabItems.map(item => {
                const video = videoMap[item.video_id];
                if (!video || !video.vocab) {
                    return null;
                }

                const itemId = item.item_id;
                let vocabItem = video.vocab.find(v => v.id === itemId || String(v.id) === String(itemId));

                if (!vocabItem && typeof itemId === 'number' && video.vocab[itemId]) {
                    vocabItem = video.vocab[itemId];
                }

                if (!vocabItem) return null;

                return {
                    id: item.id, // notebook_item 的 id，用于复习状态追踪
                    vocabId: item.item_id,
                    videoId: item.video_id,
                    word: vocabItem?.word || '',
                    meaning: vocabItem?.meaning || '',
                    phonetic: vocabItem?.ipa_us || vocabItem?.phonetic || '',
                    episode: video.episode || 0,
                    title: video.title || '',
                    reviewState: item.review_state || null, // 如果 API 返回复习状态
                };
            }).filter(Boolean);

            // 计算到期的词汇数量
            const now = new Date();
            let dueCount = 0;

            enrichedVocabs.forEach(vocab => {
                if (!vocab.reviewState || !vocab.reviewState.next_review_at) {
                    dueCount++;
                } else {
                    const nextReview = new Date(vocab.reviewState.next_review_at);
                    if (nextReview <= now) {
                        dueCount++;
                    }
                }
            });

            return {
                notebook: { id: notebookId, name: '' },
                vocabs: enrichedVocabs,
                totalVocabCount: enrichedVocabs.length,
                dueCount,
            };
        } catch (error) {
            console.error('加载词汇复习数据失败:', error);
            return null;
        }
    },

    /**
     * 加载笔记本中的句子复习数据
     * API 返回格式：{ success: true, data: [{ id, notebook_id, item_type, item_id, video_id, created_at }] }
     * @param {Object} user - 用户对象
     * @param {string|number} notebookId - 笔记本ID
     * @returns {Promise<Object>}
     */
    loadNotebookSentencesForReview: async (user, notebookId) => {
        if (!user || !notebookId) return null;

        try {
            const response = await notebooksAPI.getItems(notebookId);
            if (!response.success) {
                return null;
            }

            // API 返回的是一个扁平数组
            const rawItems = Array.isArray(response.data) ? response.data : [];
            const sentenceItems = rawItems.filter(item => item.item_type === 'sentence');

            if (sentenceItems.length === 0) {
                return {
                    notebook: { id: notebookId, name: '' },
                    sentences: [],
                    totalSentenceCount: 0,
                    dueSentenceCount: 0,
                };
            }

            // 从 Supabase 获取视频数据
            const videoIds = [...new Set(sentenceItems.map(item => item.video_id).filter(Boolean))];
            let videoMap = {};
            if (videoIds.length > 0) {
                const { data: videos, error } = await supabase
                    .from('videos')
                    .select('id, title, episode, transcript')
                    .in('id', videoIds);

                if (!error && videos) {
                    videos.forEach(v => { videoMap[v.id] = v; });
                }
            }

            // 丰富句子数据
            const enrichedSentences = sentenceItems.map(item => {
                const video = videoMap[item.video_id];
                if (!video || !video.transcript) {
                    return null;
                }

                const itemId = item.item_id;
                let sentence = null;

                // 尝试按 id 匹配
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

                if (!sentence) return null;

                return {
                    id: item.id, // notebook_item 的 id，用于复习状态追踪
                    sentenceId: item.item_id,
                    videoId: item.video_id,
                    en: sentence?.text || sentence?.en || '',
                    cn: sentence?.cn || '',
                    episode: video.episode || 0,
                    title: video.title || '',
                    reviewState: item.review_state || null, // 如果 API 返回复习状态
                };
            }).filter(Boolean);

            // 计算到期的句子数量
            const now = new Date();
            let dueSentenceCount = 0;

            enrichedSentences.forEach(sentence => {
                if (!sentence.reviewState || !sentence.reviewState.next_review_at) {
                    dueSentenceCount++;
                } else {
                    const nextReview = new Date(sentence.reviewState.next_review_at);
                    if (nextReview <= now) {
                        dueSentenceCount++;
                    }
                }
            });

            return {
                notebook: { id: notebookId, name: '' },
                sentences: enrichedSentences,
                totalSentenceCount: enrichedSentences.length,
                dueSentenceCount,
            };
        } catch (error) {
            console.error('加载句子复习数据失败:', error);
            return null;
        }
    },

    /**
     * 创建笔记本（兼容版本）
     * @param {Object} user - 用户对象
     * @param {Object} options - { name, color }
     * @returns {Promise<Object>}
     */
    createNotebook: async (user, { name, color = '#3B82F6' }) => {
        if (!user || !name) return null;

        try {
            const response = await notebooksAPI.create(name, color);
            return response.success ? response.data : null;
        } catch (error) {
            console.error('创建笔记本失败:', error);
            return null;
        }
    },

    /**
     * 删除笔记本（兼容版本）
     * @param {Object} user - 用户对象
     * @param {string|number} notebookId - 笔记本ID
     * @returns {Promise<boolean>}
     */
    deleteNotebook: async (user, notebookId) => {
        if (!user || !notebookId) return false;

        try {
            const response = await notebooksAPI.delete(notebookId);
            return response.success;
        } catch (error) {
            console.error('删除笔记本失败:', error);
            return false;
        }
    },

    /**
     * 添加条目到笔记本（兼容版本）
     * @param {Object} user - 用户对象
     * @param {Object} options - { notebookId, itemType, itemId, videoId }
     * @returns {Promise<Object>}
     */
    addItemToNotebook: async (user, { notebookId, itemType, itemId, videoId }) => {
        if (!user || !notebookId || !itemType || !itemId) return null;

        try {
            const response = await notebooksAPI.addItem(notebookId, itemType, itemId, videoId);
            return response.success ? response.data : null;
        } catch (error) {
            console.error('添加到笔记本失败:', error);
            return null;
        }
    },

    /**
     * 从笔记本移除条目（兼容版本）
     * @param {Object} user - 用户对象
     * @param {Object} options - { notebookId, itemType, itemId }
     * @returns {Promise<boolean>}
     */
    removeItemFromNotebook: async (user, { notebookId, itemType, itemId }) => {
        if (!user || !notebookId || !itemId) return false;

        try {
            const response = await notebooksAPI.deleteItem(notebookId, itemId);
            return response.success;
        } catch (error) {
            console.error('从笔记本移除失败:', error);
            return false;
        }
    },

    /**
     * 加载包含某词汇的所有句子
     * @param {Object} user - 用户对象
     * @param {Object} vocab - 词汇对象
     * @returns {Promise<Array>}
     */
    loadSentencesForVocab: async (user, vocab) => {
        if (!user || !vocab) return [];

        // 这个功能需要后端支持，暂时返回空数组
        // TODO: 后续添加后端 API 支持
        console.warn('loadSentencesForVocab: 功能待后端支持');
        return [];
    },
};
