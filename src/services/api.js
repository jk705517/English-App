const API_BASE = 'https://api.biubiuenglish.com';
// 鑾峰彇瀛樺偍鐨?token
const getToken = () => localStorage.getItem('token');
// 璁剧疆 token
export const setToken = (token) => localStorage.setItem('token', token);
// 娓呴櫎 token
export const clearToken = () => localStorage.removeItem('token');
// 閫氱敤璇锋眰鍑芥暟
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
// 璁よ瘉 API
export const authAPI = {
    register: (phone, password, nickname) =>
        request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ phone, password, nickname }),
        }),
    login: (data) =>
        request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    getMe: () => request('/api/auth/me'),
    verifyReset: async ({ phone, email }) => {
        const response = await fetch(`${API_BASE}/api/auth/verify-reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, email }),
        });
        return response.json();
    },
    resetPassword: async ({ phone, email, newPassword }) => {
        const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, email, newPassword }),
        });
        return response.json();
    },
};
// 瑙嗛 API
export const videoAPI = {
    getAll: (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.category && filters.category !== '鍏ㄩ儴') params.append('category', filters.category);
        if (filters.level) params.append('level', filters.level);
        if (filters.accent && filters.accent !== '鍏ㄩ儴') params.append('accent', filters.accent);
        if (filters.gender && filters.gender !== '鍏ㄩ儴') params.append('gender', filters.gender);
        if (filters.author) params.append('author', filters.author);
        if (filters.sort) params.append('sort', filters.sort);
        const queryString = params.toString();
        const url = queryString ? `/api/videos?${queryString}` : '/api/videos';
        return request(url);
    },
    getById: (id) => request(`/api/videos/${id}`),
    getByEpisode: (episode) => request(`/api/videos/episode/${episode}`),
};
// 鐢ㄦ埛杩涘害 API
export const progressAPI = {
    getAll: () => request('/api/user/progress'),
    add: (video_id, item_type, item_id) =>
        request('/api/user/progress', {
            method: 'POST',
            body: JSON.stringify({ video_id, item_type, item_id }),
        }),
    delete: (id) => request(`/api/user/progress/${id}`, { method: 'DELETE' }),
    // 鑾峰彇鏈€杩戝涔犵殑瑙嗛
    getRecentLearning: () => request('/api/user/recent-learning'),
};
// 鏀惰棌 API
export const favoritesAPI = {
    getAll: () => request('/api/user/favorites'),
    add: (video_id, item_type, item_id) =>
        request('/api/user/favorites', {
            method: 'POST',
            body: JSON.stringify({ video_id, item_type, item_id }),
        }),
    delete: (id) => request(`/api/user/favorites/${id}`, { method: 'DELETE' }),
};
// 绗旇鏈?API
export const notebooksAPI = {
    getAll: () => request('/api/user/notebooks'),
    create: (name, color) =>
        request('/api/user/notebooks', {
            method: 'POST',
            body: JSON.stringify({ name, color }),
        }),
    update: (id, name) =>
        request(`/api/user/notebooks/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ name }),
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
// 澶嶄範鐘舵€?API
export const reviewStatesAPI = {
    getAll: () => request('/api/user/review-states'),
    update: (data) =>
        request('/api/user/review-states', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};
// 澶嶄範鏃ュ織 API
export const reviewLogsAPI = {
    getStats: (days = 7) => request(`/api/user/review-logs?days=${days}`),
};

// 鑾峰彇璇嶆眹鍦ㄥ叾浠栬棰戜腑鐨勫嚭鐜拌褰?
export const vocabOccurrencesAPI = {
    get: async (word, excludeVideoId) => {
        let url = `${API_BASE}/api/vocab/occurrences?word=${encodeURIComponent(word)}`;
        if (excludeVideoId) {
            url += `&exclude_video_id=${excludeVideoId}`;
        }
        const response = await fetch(url);
        return response.json();
    }
};

// 璁惧绠＄悊 API
export const devicesAPI = {
    getList: () => request('/api/user/devices'),
    remove: (id) => request(`/api/user/devices/${id}`, { method: 'DELETE' }),
};

// 鍙嶉 API
export const feedbackAPI = {
    submit: (data) =>
        request('/api/user/feedback', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};

// 鐢ㄦ埛璧勬枡 API
export const profileAPI = {
    update: (data) =>
        request('/api/user/profile', {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
};

// 鐢ㄦ埛璁剧疆 API
export const userAPI = {
    updateEmail: async (email) => {
        const response = await fetch(`${API_BASE}/api/user/email`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({ email }),
        });
        return response.json();
    },
};

// 婵€娲婚摼鎺?API
export const activateAPI = {
    getInfo: async (token) => {
        const response = await fetch(`${API_BASE}/api/activate/${token}`);
        return response.json();
    },
    activate: async (token) => {
        const response = await fetch(`${API_BASE}/api/activate/${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        return response.json();
    },
};

// 绠＄悊鍛?API
export const adminAPI = {
    generateLink: async (phone, adminPassword) => {
        const response = await fetch(`${API_BASE}/api/admin/generate-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, adminPassword }),
        });
        return response.json();
    },
};
