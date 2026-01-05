// src/services/demoStorage.js
// Demo 模式的本地存储服务（不调用后端API，数据存在浏览器localStorage）

const DEMO_PASSWORD = 'biubiured2026';
const DEMO_AUTH_KEY = 'demo_authenticated';
const DEMO_AUTH_EXPIRY_KEY = 'demo_auth_expiry';
const DEMO_FAVORITES_KEY = 'demo_favorites';
const DEMO_NOTEBOOKS_KEY = 'demo_notebooks';
const DEMO_NOTEBOOK_ITEMS_KEY = 'demo_notebook_items';
const DEMO_PROGRESS_KEY = 'demo_progress';
const DEMO_REVIEW_STATES_KEY = 'demo_review_states';

// 24小时有效期（毫秒）
const AUTH_EXPIRY_DURATION = 24 * 60 * 60 * 1000;

// ============ 密码验证 ============

export const verifyDemoPassword = (password) => {
    if (password === DEMO_PASSWORD) {
        const expiry = Date.now() + AUTH_EXPIRY_DURATION;
        localStorage.setItem(DEMO_AUTH_KEY, 'true');
        localStorage.setItem(DEMO_AUTH_EXPIRY_KEY, expiry.toString());
        return true;
    }
    return false;
};

export const isDemoAuthenticated = () => {
    const authenticated = localStorage.getItem(DEMO_AUTH_KEY);
    const expiry = localStorage.getItem(DEMO_AUTH_EXPIRY_KEY);

    if (authenticated === 'true' && expiry) {
        if (Date.now() < parseInt(expiry)) {
            return true;
        }
        // 过期了，清除认证状态
        localStorage.removeItem(DEMO_AUTH_KEY);
        localStorage.removeItem(DEMO_AUTH_EXPIRY_KEY);
    }
    return false;
};

// 别名函数 - 兼容 DemoPage.jsx 的调用方式
export const isDemoPasswordVerified = () => {
    return isDemoAuthenticated();
};

export const setDemoPasswordVerified = () => {
    // 直接设置验证状态（不需要再次验证密码）
    const expiry = Date.now() + AUTH_EXPIRY_DURATION;
    localStorage.setItem(DEMO_AUTH_KEY, 'true');
    localStorage.setItem(DEMO_AUTH_EXPIRY_KEY, expiry.toString());
};

// ============ 收藏功能 ============

export const getDemoFavorites = () => {
    const stored = localStorage.getItem(DEMO_FAVORITES_KEY);
    if (!stored) {
        return { videos: [], sentences: [], vocabs: [] };
    }
    try {
        const data = JSON.parse(stored);
        // 如果是旧格式（数组），转换为新格式
        if (Array.isArray(data)) {
            return {
                videos: data.filter(f => f.itemType === 'video').map(f => f.itemId),
                sentences: data.filter(f => f.itemType === 'sentence'),
                vocabs: data.filter(f => f.itemType === 'vocab')
            };
        }
        // 新格式直接返回
        return {
            videos: data.videos || [],
            sentences: data.sentences || [],
            vocabs: data.vocabs || []
        };
    } catch {
        return { videos: [], sentences: [], vocabs: [] };
    }
};

export const addDemoFavorite = (type, itemId, videoId) => {
    const favorites = getDemoFavorites();

    if (type === 'video') {
        if (!favorites.videos.includes(itemId)) {
            favorites.videos.push(itemId);
        }
    } else if (type === 'sentence') {
        const exists = favorites.sentences.some(s => String(s.itemId) === String(itemId));
        if (!exists) {
            favorites.sentences.push({ itemId, videoId });
        }
    } else if (type === 'vocab') {
        const exists = favorites.vocabs.some(v => String(v.itemId) === String(itemId));
        if (!exists) {
            favorites.vocabs.push({ itemId, videoId });
        }
    }

    localStorage.setItem(DEMO_FAVORITES_KEY, JSON.stringify(favorites));
    return true;
};

export const removeDemoFavorite = (type, itemId) => {
    const favorites = getDemoFavorites();

    if (type === 'video') {
        favorites.videos = favorites.videos.filter(id => String(id) !== String(itemId));
    } else if (type === 'sentence') {
        favorites.sentences = favorites.sentences.filter(s => String(s.itemId) !== String(itemId));
    } else if (type === 'vocab') {
        favorites.vocabs = favorites.vocabs.filter(v => String(v.itemId) !== String(itemId));
    }

    localStorage.setItem(DEMO_FAVORITES_KEY, JSON.stringify(favorites));
    return true;
};

export const isDemoFavorited = (itemId, itemType) => {
    const favorites = getDemoFavorites();
    if (itemType === 'video') {
        return favorites.videos.includes(String(itemId));
    } else if (itemType === 'sentence') {
        return favorites.sentences.some(s => String(s.itemId) === String(itemId));
    } else if (itemType === 'vocab') {
        return favorites.vocabs.some(v => String(v.itemId) === String(itemId));
    }
    return false;
};

// ============ 本子功能 ============

export const getDemoNotebooks = () => {
    const stored = localStorage.getItem(DEMO_NOTEBOOKS_KEY);
    if (!stored) return [];
    try {
        const notebooks = JSON.parse(stored);
        // 确保每个本子都有 items 数组
        return notebooks.map(nb => ({
            ...nb,
            items: nb.items || []
        }));
    } catch {
        return [];
    }
};

export const createDemoNotebook = (name) => {
    const notebooks = getDemoNotebooks();
    const newNotebook = {
        id: 'demo-nb-' + Date.now(),
        name: name,
        items: [],
        createdAt: new Date().toISOString()
    };
    notebooks.push(newNotebook);
    localStorage.setItem(DEMO_NOTEBOOKS_KEY, JSON.stringify(notebooks));
    return newNotebook;
};

export const deleteDemoNotebook = (notebookId) => {
    let notebooks = getDemoNotebooks();
    notebooks = notebooks.filter(n => n.id !== notebookId);
    localStorage.setItem(DEMO_NOTEBOOKS_KEY, JSON.stringify(notebooks));
    return notebooks;
};

export const renameDemoNotebook = (notebookId, newName) => {
    const notebooks = getDemoNotebooks();
    const notebook = notebooks.find(n => n.id === notebookId);
    if (notebook) {
        notebook.name = newName;
        localStorage.setItem(DEMO_NOTEBOOKS_KEY, JSON.stringify(notebooks));
    }
    return notebooks;
};

// ============ 本子内容功能 ============

export const getDemoNotebookItems = (notebookId = null) => {
    const notebooks = getDemoNotebooks();
    if (notebookId) {
        const notebook = notebooks.find(nb => nb.id === notebookId);
        return notebook ? notebook.items : [];
    }
    // 返回所有本子的所有内容
    return notebooks.flatMap(nb => nb.items.map(item => ({ ...item, notebook_id: nb.id })));
};

export const addDemoNotebookItem = (notebookId, itemType, itemId, videoId) => {
    const notebooks = getDemoNotebooks();
    const notebook = notebooks.find(nb => nb.id === notebookId);

    if (!notebook) return false;

    // 检查是否已存在
    const exists = notebook.items.some(
        item => String(item.itemId) === String(itemId) && item.itemType === itemType
    );

    if (!exists) {
        notebook.items.push({
            itemId,
            itemType,
            videoId,
            addedAt: new Date().toISOString()
        });
        localStorage.setItem(DEMO_NOTEBOOKS_KEY, JSON.stringify(notebooks));
    }

    return true;
};

export const removeDemoNotebookItem = (notebookId, itemId, itemType) => {
    const notebooks = getDemoNotebooks();
    const notebook = notebooks.find(nb => nb.id === notebookId);

    if (!notebook) return false;

    notebook.items = notebook.items.filter(
        item => !(String(item.itemId) === String(itemId) && item.itemType === itemType)
    );
    localStorage.setItem(DEMO_NOTEBOOKS_KEY, JSON.stringify(notebooks));
    return true;
};

// ============ 学习进度功能 ============

export const getDemoProgress = () => {
    const data = localStorage.getItem(DEMO_PROGRESS_KEY);
    return data ? JSON.parse(data) : [];
};

export const addDemoProgress = (videoId) => {
    const progress = getDemoProgress();
    if (!progress.includes(String(videoId))) {
        progress.push(String(videoId));
        localStorage.setItem(DEMO_PROGRESS_KEY, JSON.stringify(progress));
    }
    return progress;
};

export const removeDemoProgress = (videoId) => {
    let progress = getDemoProgress();
    progress = progress.filter(id => id !== String(videoId));
    localStorage.setItem(DEMO_PROGRESS_KEY, JSON.stringify(progress));
    return progress;
};

export const isDemoLearned = (videoId) => {
    const progress = getDemoProgress();
    return progress.includes(String(videoId));
};

// ============ 复习状态功能 ============

export const getDemoReviewStates = () => {
    const data = localStorage.getItem(DEMO_REVIEW_STATES_KEY);
    return data ? JSON.parse(data) : [];
};

export const updateDemoReviewState = (itemId, itemType, isKnown) => {
    const states = getDemoReviewStates();
    const existingIndex = states.findIndex(s =>
        s.item_id === itemId && s.item_type === itemType
    );

    const now = new Date().toISOString();

    if (existingIndex >= 0) {
        const existing = states[existingIndex];
        if (isKnown) {
            existing.proficiency = Math.min((existing.proficiency || 0) + 1, 5);
        } else {
            existing.proficiency = 0;
        }
        const intervals = [1, 3, 7, 14, 30, 60];
        const days = intervals[existing.proficiency] || 60;
        existing.next_review_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        existing.last_reviewed_at = now;
    } else {
        const proficiency = isKnown ? 1 : 0;
        const intervals = [1, 3, 7, 14, 30, 60];
        const days = intervals[proficiency];
        states.push({
            id: Date.now(),
            item_id: itemId,
            item_type: itemType,
            proficiency,
            next_review_at: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
            last_reviewed_at: now,
            created_at: now
        });
    }

    localStorage.setItem(DEMO_REVIEW_STATES_KEY, JSON.stringify(states));
    return states;
};

// ============ 清除所有 Demo 数据 ============

export const clearAllDemoData = () => {
    localStorage.removeItem(DEMO_AUTH_KEY);
    localStorage.removeItem(DEMO_AUTH_EXPIRY_KEY);
    localStorage.removeItem(DEMO_FAVORITES_KEY);
    localStorage.removeItem(DEMO_NOTEBOOKS_KEY);
    localStorage.removeItem(DEMO_NOTEBOOK_ITEMS_KEY);
    localStorage.removeItem(DEMO_PROGRESS_KEY);
    localStorage.removeItem(DEMO_REVIEW_STATES_KEY);
};
