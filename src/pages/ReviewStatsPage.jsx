import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Calendar, Flame, BookOpen, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { loadReviewStats } from '../services/reviewService';

function ReviewStatsPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        if (user) {
            fetchStats();
        } else {
            setLoading(false);
        }
    }, [user]);

    const fetchStats = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await loadReviewStats(user);
            setStats(result);
            console.log('[ReviewStats] summary:', result.summary);
            console.log('[ReviewStats] days:', result.days);
        } catch (err) {
            console.error('[ReviewStats] error:', err);
            setError('统计数据加载失败，请稍后重试');
        }
        setLoading(false);
    };

    // 未登录提示
    if (!user) {
        return (
            <div className="max-w-3xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                        <BarChart3 className="w-8 h-8 text-indigo-600" />
                        学习统计
                    </h1>
                </div>
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-sm">
                    <BarChart3 className="w-24 h-24 text-gray-300 mb-4" />
                    <p className="text-xl text-gray-500 mb-2">统计功能需要登录后使用</p>
                    <p className="text-gray-400 mb-6">登录后可以查看你的学习进度</p>
                    <Link
                        to="/login"
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                    >
                        去登录
                    </Link>
                </div>
            </div>
        );
    }

    // 加载中
    if (loading) {
        return (
            <div className="max-w-3xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                        <BarChart3 className="w-8 h-8 text-indigo-600" />
                        学习统计
                    </h1>
                    <p className="text-gray-500">最近 7 天的复习情况（词汇 + 句子）</p>
                </div>
                <div className="flex items-center justify-center py-20 bg-white rounded-xl shadow-sm">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                    <span className="ml-3 text-gray-500">加载中...</span>
                </div>
            </div>
        );
    }

    // 加载失败
    if (error) {
        return (
            <div className="max-w-3xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                        <BarChart3 className="w-8 h-8 text-indigo-600" />
                        学习统计
                    </h1>
                </div>
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-sm">
                    <p className="text-red-500 mb-4">{error}</p>
                    <button
                        onClick={fetchStats}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                    >
                        重试
                    </button>
                </div>
            </div>
        );
    }

    const { days, summary } = stats || { days: [], summary: {} };
    const { totalCount, vocabCount, sentenceCount, currentStreak } = summary;

    // 计算柱状图最大值（用于高度比例）
    const maxTotal = Math.max(...days.map(d => d.total), 1);

    return (
        <div className="max-w-3xl mx-auto">
            {/* 标题区 */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                    <BarChart3 className="w-8 h-8 text-indigo-600" />
                    学习统计
                </h1>
                <p className="text-gray-500">最近 7 天的复习情况（词汇 + 句子）</p>
            </div>

            {/* 概览卡片 */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                {totalCount > 0 ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-lg">
                            <Calendar className="w-5 h-5 text-indigo-600" />
                            <span>
                                最近 7 天一共复习了{' '}
                                <span className="font-bold text-indigo-600">{totalCount}</span> 次
                                <span className="text-gray-500 text-base ml-1">
                                    （{vocabCount} 个词 · {sentenceCount} 个句子）
                                </span>
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-lg">
                            <Flame className="w-5 h-5 text-orange-500" />
                            <span>
                                当前连续打卡：
                                <span className="font-bold text-orange-500">{currentStreak}</span> 天
                                {currentStreak >= 3 && ' 🔥'}
                                {currentStreak >= 7 && ' 太棒了！'}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <p className="text-gray-500 text-lg mb-2">
                            最近 7 天还没有任何复习记录 💤
                        </p>
                        <p className="text-gray-400">
                            今天就从随便练一练开始吧～
                        </p>
                        <Link
                            to="/notebooks"
                            className="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                        >
                            去复习
                        </Link>
                    </div>
                )}
            </div>

            {/* 简易柱状图 */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">每日复习趋势</h2>
                <div className="flex items-end justify-between gap-2 h-32">
                    {[...days].reverse().map((day) => {
                        const height = day.total > 0 ? Math.max((day.total / maxTotal) * 100, 10) : 4;
                        const hasActivity = day.total > 0;

                        return (
                            <div
                                key={day.date}
                                className="flex-1 flex flex-col items-center"
                            >
                                <div
                                    className={`w-full rounded-t-md transition-all ${hasActivity
                                            ? 'bg-indigo-500'
                                            : 'bg-gray-200'
                                        }`}
                                    style={{ height: `${height}%` }}
                                    title={`${day.label}: ${day.total} 次`}
                                />
                                <span className="text-xs text-gray-500 mt-2 truncate w-full text-center">
                                    {day.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 每日列表 */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <h2 className="text-lg font-semibold text-gray-800 p-4 border-b border-gray-100">
                    详细记录
                </h2>
                <div className="divide-y divide-gray-100">
                    {days.map((day) => (
                        <div
                            key={day.date}
                            className={`flex items-center justify-between px-4 py-3 ${day.total === 0 ? 'text-gray-400' : ''
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="font-medium w-12">{day.label}</span>
                                <span className="text-sm text-gray-400">{day.date}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                {day.total > 0 ? (
                                    <>
                                        <span className="font-semibold text-indigo-600">
                                            {day.total} 次
                                        </span>
                                        <div className="flex items-center gap-3 text-sm text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <BookOpen className="w-4 h-4" />
                                                {day.vocab}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <MessageSquare className="w-4 h-4" />
                                                {day.sentence}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <span className="text-gray-400">—</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default ReviewStatsPage;
