import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './utils/toast.js'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'

// 新 SW 接管后显示提示并自动刷新（用 sessionStorage 防止 reload 后循环触发）
if ('serviceWorker' in navigator) {
    // 页面加载时检测标记：若是刚刚因 SW 更新而 reload 的，清除标记后不再触发
    if (sessionStorage.getItem('sw-reloading')) {
        sessionStorage.removeItem('sw-reloading');
    } else {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            sessionStorage.setItem('sw-reloading', '1');
            const banner = document.createElement('div');
            banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#7C3AED;color:white;text-align:center;padding:12px;font-size:14px;';
            banner.textContent = '发现新版本，正在更新...';
            document.body.appendChild(banner);
            setTimeout(() => window.location.reload(), 1500);
        });
    }
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <ThemeProvider>
            <AuthProvider>
                <App />
            </AuthProvider>
        </ThemeProvider>
    </StrictMode>,
)
