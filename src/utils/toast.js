/**
 * Toast 轻提示工具
 * 用于显示临时提示信息
 */

export function showToast(message, duration = 2000) {
    // 移除已存在的 toast
    const existing = document.querySelector('.toast-message');
    if (existing) existing.remove();

    // 创建新 toast
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    document.body.appendChild(toast);

    // 自动移除
    setTimeout(() => toast.remove(), duration);
}

// 挂载到 window 供全局使用
if (typeof window !== 'undefined') {
    window.showToast = showToast;
}
