// src/pages/DemoPage.jsx
// Demo 试用页面 - 密码保护 + 本地存储

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    verifyDemoPassword,
    isDemoAuthenticated,
    getDemoFavorites,
    addDemoFavorite,
    removeDemoFavorite,
    isDemoFavorited,
    getDemoNotebooks,
    createDemoNotebook,
    getDemoNotebookItems,
    addDemoNotebookItem,
    addDemoProgress,
    removeDemoProgress,
    isDemoLearned
} from '../services/demoStorage';
import { videoAPI } from '../services/api';

// Demo 视频的 episode
const DEMO_EPISODE = 29;

const DemoPage = () => {
    // 认证状态
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');

    // 视频数据
    const [videoData, setVideoData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 播放器状态
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const videoRef = useRef(null);

    // 模式切换
    const [subtitleMode, setSubtitleMode] = useState('bilingual');
    const [viewMode, setViewMode] = useState('normal');

    // 收藏状态
    const [favorites, setFavorites] = useState([]);

    // 本子状态
    const [notebooks, setNotebooks] = useState([]);
    const [showNotebookDialog, setShowNotebookDialog] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [newNotebookName, setNewNotebookName] = useState('');

    // 学习状态
    const [isLearned, setIsLearned] = useState(false);

    // 当前字幕索引
    const [currentSubtitleIndex, setCurrentSubtitleIndex] = useState(0);

    // 响应式
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1280);

    // 检查认证状态
    useEffect(() => {
        setIsAuthenticated(isDemoAuthenticated());
    }, []);

    // 加载视频数据
    useEffect(() => {
        if (isAuthenticated) {
            loadVideoData();
            loadLocalData();
        }
    }, [isAuthenticated]);

    // 监听窗口大小
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1280);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 加载视频数据
    const loadVideoData = async () => {
        try {
            setLoading(true);
            const response = await videoAPI.getByEpisode(DEMO_EPISODE);
            if (response.data) {
                setVideoData(response.data);
                setIsLearned(isDemoLearned(response.data.id));
            }
        } catch (err) {
            setError('加载视频失败');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // 加载本地存储数据
    const loadLocalData = () => {
        setFavorites(getDemoFavorites());
        setNotebooks(getDemoNotebooks());
    };

    // 密码验证
    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        if (verifyDemoPassword(password)) {
            setIsAuthenticated(true);
            setPasswordError('');
        } else {
            setPasswordError('密码错误，请重试');
        }
    };

    // 播放指定字幕
    const playSubtitle = (startTime) => {
        if (videoRef.current) {
            videoRef.current.currentTime = startTime;
            videoRef.current.play();
            setIsPlaying(true);
        }
    };

    // 更新当前字幕索引
    useEffect(() => {
        if (videoData?.transcript) {
            const index = videoData.transcript.findIndex((sub, i) => {
                const next = videoData.transcript[i + 1];
                return currentTime >= sub.start && (!next || currentTime < next.start);
            });
            if (index !== -1) {
                setCurrentSubtitleIndex(index);
            }
        }
    }, [currentTime, videoData]);

    // 收藏功能
    const handleToggleFavorite = (item, type) => {
        const itemId = `${videoData.id}-${type}-${item.index || 0}`;
        if (isDemoFavorited(itemId, type)) {
            removeDemoFavorite(itemId, type);
        } else {
            addDemoFavorite({
                item_id: itemId,
                item_type: type,
                video_id: videoData.id,
                video_title: videoData.title,
                episode: videoData.episode,
                content: type === 'sentence' ? item.text : item.word,
                translation: type === 'sentence' ? item.translation : item.meaning
            });
        }
        setFavorites(getDemoFavorites());
    };

    // 打开添加到本子对话框
    const openNotebookDialog = (item, type) => {
        setSelectedItem({ ...item, type });
        setShowNotebookDialog(true);
    };

    // 添加到本子
    const handleAddToNotebook = (notebookId) => {
        if (selectedItem) {
            const itemId = `${videoData.id}-${selectedItem.type}-${selectedItem.index || 0}`;
            addDemoNotebookItem(notebookId, {
                item_id: itemId,
                item_type: selectedItem.type,
                video_id: videoData.id,
                video_title: videoData.title,
                episode: videoData.episode,
                content: selectedItem.type === 'sentence' ? selectedItem.text : selectedItem.word,
                translation: selectedItem.type === 'sentence' ? selectedItem.translation : selectedItem.meaning
            });
            setShowNotebookDialog(false);
            setSelectedItem(null);
        }
    };

    // 创建新本子
    const handleCreateNotebook = () => {
        if (newNotebookName.trim()) {
            createDemoNotebook(newNotebookName.trim());
            setNotebooks(getDemoNotebooks());
            setNewNotebookName('');
        }
    };

    // 标记已学习
    const handleToggleLearned = () => {
        if (isLearned) {
            removeDemoProgress(videoData.id);
        } else {
            addDemoProgress(videoData.id);
        }
        setIsLearned(!isLearned);
    };

    // ============ 渲染密码验证页面 ============
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <span className="text-white text-2xl font-bold">B</span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800">BiuBiu English</h1>
                        <p className="text-gray-500 mt-2">刷视频学英语 · 试用体验</p>
                    </div>

                    <form onSubmit={handlePasswordSubmit}>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                请输入试用密码
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition"
                                placeholder="输入密码"
                                autoFocus
                            />
                            {passwordError && (
                                <p className="text-red-500 text-sm mt-2">{passwordError}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-violet-500 hover:bg-violet-600 text-white font-medium py-3 px-4 rounded-lg transition"
                        >
                            开始试用
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-500">
                            密码可在小红书主页获取
                        </p>
                        <a
                            href="https://xhslink.com/m/61lw0enbqKQ"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-500 hover:text-violet-600 text-sm font-medium mt-1 inline-block"
                        >
                            前往小红书 →
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    // ============ 加载中 ============
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-gray-500 mt-4">加载中...</p>
                </div>
            </div>
        );
    }

    // ============ 错误 ============
    if (error || !videoData) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-500 text-lg">{error || '视频不存在'}</p>
                </div>
            </div>
        );
    }

    // ============ 渲染视频详情页面 ============
    return (
        <div className="min-h-screen bg-gray-50">
            {/* 顶部横幅 */}
            <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white py-3 px-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🎁</span>
                        <span className="font-medium">试用模式</span>
                        <span className="text-violet-200 text-sm hidden sm:inline">· 体验完整功能</span>
                    </div>
                    <a
                        href="https://xhslink.com/m/61lw0enbqKQ"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white text-violet-600 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-violet-50 transition"
                    >
                        获取完整版
                    </a>
                </div>
            </div>

            {/* 主内容区 */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* 视频标题 */}
                <div className="mb-4">
                    <h1 className="text-xl font-bold text-gray-800">
                        第{videoData.episode}期：{videoData.title}
                    </h1>
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                        <span>{videoData.author}</span>
                        <span>·</span>
                        <span>{videoData.duration}</span>
                        {videoData.accent && (
                            <>
                                <span>·</span>
                                <span className="px-2 py-0.5 bg-violet-100 text-violet-600 rounded">
                                    {videoData.accent}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                <div className={`flex ${isMobile ? 'flex-col' : 'flex-row gap-6'}`}>
                    {/* 视频播放器 */}
                    <div className={`${isMobile ? 'w-full' : 'w-1/2'}`}>
                        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                            <video
                                ref={videoRef}
                                src={videoData.video_url}
                                poster={videoData.cover}
                                className="w-full h-full"
                                controls
                                onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                            />
                        </div>

                        {/* 学习按钮 */}
                        <div className="mt-4 flex gap-3">
                            <button
                                onClick={handleToggleLearned}
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${isLearned
                                        ? 'bg-green-100 text-green-600 border border-green-200'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {isLearned ? '✓ 已标记学习' : '标记为已学习'}
                            </button>
                        </div>
                    </div>

                    {/* 字幕区域 */}
                    <div className={`${isMobile ? 'w-full mt-4' : 'w-1/2'}`}>
                        {/* 模式切换 */}
                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setViewMode('normal')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === 'normal'
                                        ? 'bg-violet-500 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                普通模式
                            </button>
                            <button
                                onClick={() => setViewMode('intensive')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === 'intensive'
                                        ? 'bg-violet-500 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                精读模式
                            </button>
                        </div>

                        {/* 字幕显示切换 */}
                        <div className="flex gap-2 mb-4">
                            {['bilingual', 'english', 'chinese'].map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setSubtitleMode(mode)}
                                    className={`px-3 py-1 rounded text-xs font-medium transition ${subtitleMode === mode
                                            ? 'bg-violet-100 text-violet-600'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                >
                                    {mode === 'bilingual' ? '双语' : mode === 'english' ? '英文' : '中文'}
                                </button>
                            ))}
                        </div>

                        {/* 字幕列表 */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-100 max-h-[500px] overflow-y-auto">
                            {videoData.transcript?.map((subtitle, index) => {
                                const isCurrent = index === currentSubtitleIndex;
                                const itemId = `${videoData.id}-sentence-${index}`;
                                const isFavorited = isDemoFavorited(itemId, 'sentence');

                                return (
                                    <div
                                        key={index}
                                        className={`p-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition ${isCurrent ? 'bg-violet-50' : ''
                                            }`}
                                        onClick={() => playSubtitle(subtitle.start)}
                                    >
                                        {/* 英文 */}
                                        {(subtitleMode === 'bilingual' || subtitleMode === 'english') && (
                                            <p className={`text-gray-800 ${isCurrent ? 'font-medium' : ''}`}>
                                                {subtitle.text}
                                            </p>
                                        )}

                                        {/* 中文 */}
                                        {(subtitleMode === 'bilingual' || subtitleMode === 'chinese') && (
                                            <p className="text-gray-500 text-sm mt-1">
                                                {subtitle.translation}
                                            </p>
                                        )}

                                        {/* 精读内容 */}
                                        {viewMode === 'intensive' && subtitle.analysis && (
                                            <div className="mt-3 space-y-2">
                                                {subtitle.analysis.takeaway && (
                                                    <div className="bg-violet-50 p-3 rounded-lg text-sm text-violet-700">
                                                        <span className="font-medium">💡 学习要点：</span>
                                                        <span className="ml-1">{subtitle.analysis.takeaway}</span>
                                                    </div>
                                                )}
                                                {subtitle.analysis.expression && (
                                                    <div className="bg-amber-50 p-3 rounded-lg text-sm text-amber-700">
                                                        <span className="font-medium">🗣 地道表达：</span>
                                                        <span className="ml-1">{subtitle.analysis.expression}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* 操作按钮 */}
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleFavorite({ ...subtitle, index }, 'sentence');
                                                }}
                                                className={`text-xs px-2 py-1 rounded transition ${isFavorited
                                                        ? 'bg-red-100 text-red-500'
                                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                    }`}
                                            >
                                                {isFavorited ? '❤️ 已收藏' : '🤍 收藏'}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openNotebookDialog({ ...subtitle, index }, 'sentence');
                                                }}
                                                className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
                                            >
                                                📒 加入本子
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 重点词汇区域 */}
                {videoData.vocab && videoData.vocab.length > 0 && (
                    <div className="mt-8">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">📚 重点词汇</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {videoData.vocab.map((vocab, index) => {
                                const itemId = `${videoData.id}-vocab-${index}`;
                                const isFavorited = isDemoFavorited(itemId, 'vocab');

                                return (
                                    <div
                                        key={index}
                                        className="bg-white p-4 rounded-lg shadow-sm border border-gray-100"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="font-medium text-gray-800">{vocab.word}</p>
                                                <p className="text-sm text-gray-500 mt-1">{vocab.phonetic}</p>
                                                <p className="text-sm text-violet-600 mt-1">{vocab.meaning}</p>
                                            </div>
                                        </div>
                                        {vocab.example && (
                                            <p className="text-sm text-gray-600 mt-2 italic">"{vocab.example}"</p>
                                        )}
                                        {/* 操作按钮 */}
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={() => handleToggleFavorite({ ...vocab, index }, 'vocab')}
                                                className={`text-xs px-2 py-1 rounded transition ${isFavorited
                                                        ? 'bg-red-100 text-red-500'
                                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                    }`}
                                            >
                                                {isFavorited ? '❤️ 已收藏' : '🤍 收藏'}
                                            </button>
                                            <button
                                                onClick={() => openNotebookDialog({ ...vocab, index }, 'vocab')}
                                                className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
                                            >
                                                📒 加入本子
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* 底部引导 */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        <p className="font-medium text-gray-800">想学更多？</p>
                        <p className="text-sm text-gray-500">目前已有 30+ 期精选视频</p>
                    </div>
                    <a
                        href="https://xhslink.com/m/61lw0enbqKQ"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-violet-500 hover:bg-violet-600 text-white px-6 py-2.5 rounded-lg font-medium transition"
                    >
                        获取完整版
                    </a>
                </div>
            </div>

            {/* 本子弹窗 */}
            {showNotebookDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">添加到本子</h3>

                        {/* 本子列表 */}
                        {notebooks.length > 0 ? (
                            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                                {notebooks.map((notebook) => (
                                    <button
                                        key={notebook.id}
                                        onClick={() => handleAddToNotebook(notebook.id)}
                                        className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 hover:bg-violet-50 hover:text-violet-600 transition"
                                    >
                                        📒 {notebook.name}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm mb-4">还没有本子，创建一个吧</p>
                        )}

                        {/* 新建本子 */}
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={newNotebookName}
                                onChange={(e) => setNewNotebookName(e.target.value)}
                                placeholder="输入本子名称"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                            />
                            <button
                                onClick={handleCreateNotebook}
                                disabled={!newNotebookName.trim()}
                                className="px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                            >
                                创建
                            </button>
                        </div>

                        {/* 关闭按钮 */}
                        <button
                            onClick={() => {
                                setShowNotebookDialog(false);
                                setSelectedItem(null);
                            }}
                            className="w-full py-2 text-gray-500 hover:text-gray-700 transition"
                        >
                            取消
                        </button>
                    </div>
                </div>
            )}

            {/* 底部占位 */}
            <div className="h-20"></div>
        </div>
    );
};

export default DemoPage;
