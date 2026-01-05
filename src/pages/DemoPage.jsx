import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VideoDetail from './VideoDetail';
import * as demoStorage from '../services/demoStorage';

const DEMO_PASSWORD = 'biubiured2026';
const DEMO_EPISODE = 29;
const XIAOHONGSHU_LINK = 'https://xhslink.com/m/61lw0enbqKQ';

const DemoPage = () => {
    const navigate = useNavigate();
    const [isVerified, setIsVerified] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    // 检查是否已验证过（24小时内）
    useEffect(() => {
        const verified = demoStorage.isDemoPasswordVerified();
        setIsVerified(verified);
        setLoading(false);
    }, []);

    // 验证密码
    const handleSubmit = (e) => {
        e.preventDefault();
        if (password === DEMO_PASSWORD) {
            demoStorage.setDemoPasswordVerified();
            setIsVerified(true);
            setError('');
        } else {
            setError('密码错误，请检查后重试');
        }
    };

    // 加载中
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
            </div>
        );
    }

    // 未验证：显示密码输入界面
    if (!isVerified) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <span className="text-white text-2xl font-bold">B</span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800">BiuBiu English</h1>
                        <p className="text-gray-500 mt-2">刷视频学英语 · 试用体验</p>
                    </div>

                    {/* 密码表单 */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                请输入试用密码
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="从小红书获取密码"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent text-base"
                                style={{ fontSize: '16px' }}
                                autoFocus
                            />
                        </div>

                        {error && (
                            <p className="text-red-500 text-sm">{error}</p>
                        )}

                        <button
                            type="submit"
                            className="w-full py-3 bg-violet-500 text-white rounded-xl font-medium hover:bg-violet-600 transition-colors"
                        >
                            开始体验
                        </button>
                    </form>

                    {/* 群聊二维码提示 */}
                    <div className="mt-6 p-4 bg-violet-50 rounded-xl border border-violet-100">
                        <p className="text-violet-700 text-sm mb-3 text-center">
                            💡 试用密码可在「BiuBiu英语学习群」获取
                        </p>
                        <p className="text-gray-600 text-sm mb-3 text-center">
                            👇 扫码加群领取密码
                        </p>
                        <div className="flex justify-center">
                            <img
                                src="/group-qr.png"
                                alt="群聊二维码"
                                className="w-40 h-40 rounded-lg"
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 已验证：显示视频详情页
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* 顶部试用横幅 */}
            <div className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-4 py-3 text-center shrink-0">
                <p className="text-sm md:text-base">
                    🎉 试用体验中 · 收藏和本子功能数据保存在本地
                    <a
                        href={XIAOHONGSHU_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 underline font-medium hover:text-violet-100"
                    >
                        获取完整版 →
                    </a>
                </p>
            </div>

            {/* 视频详情内容 - 使用 Demo 模式 */}
            <div className="flex-1">
                <VideoDetail isDemo={true} demoEpisode={29} />
            </div>

            {/* 底部固定引导栏 */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-50">
                <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">喜欢这种学习方式？</p>
                        <p className="text-sm text-gray-500 truncate">解锁全部视频，开始系统学习</p>
                    </div>
                    <a
                        href={XIAOHONGSHU_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 px-6 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                        小红书购买
                    </a>
                </div>
            </div>
        </div>
    );
};

export default DemoPage;
