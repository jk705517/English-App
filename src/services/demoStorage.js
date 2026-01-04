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

// ============ 收藏功能 ============

export const getDemoFavorites = () => {
    const data = localStorage.getItem(DEMO_FAVORITES_KEY);
    return data ? JSON.parse(data) : [];
};

export const addDemoFavorite = (item) => {
    const favorites = getDemoFavorites();
    const exists = favorites.some(f =>
        f.item_id === item.item_id && f.item_type === item.item_type
    );
    if (!exists) {
        favorites.push({
            ...item,
            id: Date.now(),
            created_at: new Date().toISOString()
        });
        localStorage.setItem(DEMO_FAVORITES_KEY, JSON.stringify(favorites));
    }
    return favorites;
};

export const removeDemoFavorite = (itemId, itemType) => {
    let favorites = getDemoFavorites();
    favorites = favorites.filter(f =>
        !(f.item_id === itemId && f.item_type === itemType)
    );
    localStorage.setItem(DEMO_FAVORITES_KEY, JSON.stringify(favorites));
    return favorites;
};

export const isDemoFavorited = (itemId, itemType) => {
    const favorites = getDemoFavorites();
    return favorites.some(f =>
        f.item_id === itemId && f.item_type === itemType
    );
};

// ============ 本子功能 ============

export const getDemoNotebooks = () => {
    const data = localStorage.getItem(DEMO_NOTEBOOKS_KEY);
    return data ? JSON.parse(data) : [];
};

export const createDemoNotebook = (name) => {
    const notebooks = getDemoNotebooks();
    const newNotebook = {
        id: Date.now(),
        name,
        created_at: new Date().toISOString()
    };
    notebooks.push(newNotebook);
    localStorage.setItem(DEMO_NOTEBOOKS_KEY, JSON.stringify(notebooks));
    return newNotebook;
};

export const deleteDemoNotebook = (notebookId) => {
    let notebooks = getDemoNotebooks();
    notebooks = notebooks.filter(n => n.id !== notebookId);
    localStorage.setItem(DEMO_NOTEBOOKS_KEY, JSON.stringify(notebooks));

    let items = getDemoNotebookItems();
    items = items.filter(i => i.notebook_id !== notebookId);
    localStorage.setItem(DEMO_NOTEBOOK_ITEMS_KEY, JSON.stringify(items));

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
    const data = localStorage.getItem(DEMO_NOTEBOOK_ITEMS_KEY);
    const items = data ? JSON.parse(data) : [];
    if (notebookId) {
        return items.filter(i => i.notebook_id === notebookId);
    }
    return items;
};

export const addDemoNotebookItem = (notebookId, item) => {
    const items = getDemoNotebookItems();
    const exists = items.some(i =>
        i.notebook_id === notebookId &&
        i.item_id === item.item_id &&
        i.item_type === item.item_type
    );
    if (!exists) {
        items.push({
            ...item,
            id: Date.now(),
            notebook_id: notebookId,
            created_at: new Date().toISOString()
        });
        localStorage.setItem(DEMO_NOTEBOOK_ITEMS_KEY, JSON.stringify(items));
    }
    return items;
};

export const removeDemoNotebookItem = (notebookId, itemId, itemType) => {
    let items = getDemoNotebookItems();
    items = items.filter(i =>
        !(i.notebook_id === notebookId && i.item_id === itemId && i.item_type === itemType)
    );
    localStorage.setItem(DEMO_NOTEBOOK_ITEMS_KEY, JSON.stringify(items));
    return items;
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
