const API_BASE = 'https://api.biubiuenglish.com';

// 获取存储的 token
const getToken = () => localStorage.getItem('token');

// 设置 token
export const setToken = (token) => localStorage.setItem('token', token);

// 清除 token
export const clearToken = () => localStorage.removeItem('token');

// 通用请求函数
const request = async (endpoint, options = {}) => {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data;
};

// 认证 API
export const authAPI = {
    register: (email, password, nickname) =>
        request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, nickname }),
        }),

    login: (email, password) =>
        request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

    getMe: () => request('/api/auth/me'),
};

// 视频 API
export const videoAPI = {
    getAll: () => request('/api/videos'),
    getById: (id) => request(`/api/videos/${id}`),
};

// 用户进度 API
export const progressAPI = {
    getAll: () => request('/api/user/progress'),
    add: (video_id, item_type, item_id) =>
        request('/api/user/progress', {
            method: 'POST',
            body: JSON.stringify({ video_id, item_type, item_id }),
        }),
    delete: (id) => request(`/api/user/progress/${id}`, { method: 'DELETE' }),
};

// 收藏 API
export const favoritesAPI = {
    getAll: () => request('/api/user/favorites'),
    add: (video_id, item_type, item_id) =>
        request('/api/user/favorites', {
            method: 'POST',
            body: JSON.stringify({ video_id, item_type, item_id }),
        }),
    delete: (id) => request(`/api/user/favorites/${id}`, { method: 'DELETE' }),
};

// 笔记本 API
export const notebooksAPI = {
    getAll: () => request('/api/user/notebooks'),
    create: (name, color) =>
        request('/api/user/notebooks', {
            method: 'POST',
            body: JSON.stringify({ name, color }),
        }),
    delete: (id) => request(`/api/user/notebooks/${id}`, { method: 'DELETE' }),
    getItems: (id) => request(`/api/user/notebooks/${id}/items`),
    addItem: (notebookId, item_type, item_id, video_id) =>
        request(`/api/user/notebooks/${notebookId}/items`, {
            method: 'POST',
            body: JSON.stringify({ item_type, item_id, video_id }),
        }),
    deleteItem: (notebookId, itemId) =>
        request(`/api/user/notebooks/${notebookId}/items/${itemId}`, { method: 'DELETE' }),
};

// 复习状态 API
export const reviewStatesAPI = {
    getAll: () => request('/api/user/review-states'),
    update: (data) =>
        request('/api/user/review-states', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};

// 复习日志 API
export const reviewLogsAPI = {
    getStats: (days = 7) => request(`/api/user/review-logs?days=${days}`),
};

