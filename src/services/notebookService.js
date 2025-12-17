import { notebooksAPI } from './api';

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
     * @param {Object} user - 用户对象
     * @param {string|number} notebookId - 笔记本ID
     * @returns {Promise<Object>}
     */
    loadNotebookDetail: async (user, notebookId) => {
        if (!user || !notebookId) return null;

        try {
            const response = await notebooksAPI.getItems(notebookId);
            if (!response.success) {
                return null;
            }

            const items = response.data || {};

            return {
                notebook: items.notebook || { id: notebookId, name: '', color: '#3B82F6' },
                sentences: items.sentences || [],
                vocabs: items.vocabs || [],
            };
        } catch (error) {
            console.error('加载笔记本详情失败:', error);
            return null;
        }
    },

    /**
     * 加载笔记本中的词汇复习数据
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

            const items = response.data || {};
            const vocabs = items.vocabs || [];

            // 计算到期的词汇数量（基于 reviewState）
            const now = new Date();
            let dueCount = 0;

            vocabs.forEach(vocab => {
                if (!vocab.reviewState || !vocab.reviewState.next_review_at) {
                    // 没有复习记录，视为需要复习
                    dueCount++;
                } else {
                    const nextReview = new Date(vocab.reviewState.next_review_at);
                    if (nextReview <= now) {
                        dueCount++;
                    }
                }
            });

            return {
                notebook: items.notebook || { id: notebookId, name: '' },
                vocabs,
                totalVocabCount: vocabs.length,
                dueCount,
            };
        } catch (error) {
            console.error('加载词汇复习数据失败:', error);
            return null;
        }
    },

    /**
     * 加载笔记本中的句子复习数据
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

            const items = response.data || {};
            const sentences = items.sentences || [];

            // 计算到期的句子数量（基于 reviewState）
            const now = new Date();
            let dueSentenceCount = 0;

            sentences.forEach(sentence => {
                if (!sentence.reviewState || !sentence.reviewState.next_review_at) {
                    // 没有复习记录，视为需要复习
                    dueSentenceCount++;
                } else {
                    const nextReview = new Date(sentence.reviewState.next_review_at);
                    if (nextReview <= now) {
                        dueSentenceCount++;
                    }
                }
            });

            return {
                notebook: items.notebook || { id: notebookId, name: '' },
                sentences,
                totalSentenceCount: sentences.length,
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
