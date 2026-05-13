import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './utils/toast.js'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'

// 新 SW 接管后显示提示并自动刷新（用 sessionStorage 防止 reload 后循环触发）
// 主动轮询 SW 更新：每 30 分钟一次 + 每次从后台切回前台时，避免老用户卡在缓存里拿不到新版
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

        // 主动轮询 SW 更新——iOS 默认更新检查太保守（最坏几天才查一次）
        navigator.serviceWorker.getRegistration().then(reg => {
            if (!reg) return;
            const check = () => { reg.update().catch(() => { }); };
            check(); // 进站立刻检查一次
            setInterval(check, 30 * 60 * 1000); // 每 30 分钟
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) check(); // 从后台切回前台也检查
            });
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
