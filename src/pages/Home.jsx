import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { progressService } from '../services/progressService';
import { favoritesService } from '../services/favoritesService';
import VideoCard from '../components/VideoCard';
import { BookOpen, CheckCircle, Circle } from 'lucide-react';

function Home() {
    const { user } = useAuth();
    const [videos, setVideos] = useState([]);
    const [learnedVideoIds, setLearnedVideoIds] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('全部');

    // 分类列表
    const categories = ['全部', '日常', '职场', '旅行', '时尚', '美食', '科技', '成长'];

    // 并行获取视频数据和已学习状态
    useEffect(() => {
        const loadData = async () => {
            // 获取视频列表的函数（从新 Vercel API）
            const fetchVideos = async () => {
                try {
                    const response = await fetch('https://biubiu-api.vercel.app/api/videos');
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const result = await response.json();
                    // 新 API 返回格式: { success: true, data: [...], count: 10 }
                    if (result.success) {
                        return { data: result.data, error: null };
                    } else {
                        return { data: null, error: result.error || 'Unknown error' };
                    }
                } catch (error) {
                    return { data: null, error: error.message };
                }
            };

            const [videosResult, learnedIds] = await Promise.all([
                fetchVideos(),
                progressService.loadLearnedVideoIds(user)
            ]);

            if (!videosResult.error) {
                // API 返回数据后按 episode 降序排列
                const sortedVideos = (videosResult.data || []).sort((a, b) => b.episode - a.episode);
                setVideos(sortedVideos);
            } else {
                console.error('Error fetching videos:', videosResult.error);
            }
            setLearnedVideoIds(learnedIds);
        };

        loadData();
    }, [user]);

    // 筛选视频
    const filteredVideos = selectedCategory === '全部'
        ? videos
        : videos.filter(video => video.category === selectedCategory);

    // 计算统计数据
    const totalVideos = videos.length;
    const learnedVideos = learnedVideoIds.length;
    const unlearnedVideos = totalVideos - learnedVideos;

    return (
        <div className="max-w-7xl mx-auto fade-in">
            {/* 页面标题 */}
            <div className="mb-8">
                <div className="mb-4 text-sm font-medium text-indigo-600">
                    {user ? `当前用户：${user.email}` : '当前未登录'}
                </div>
                <h1 className="text-4xl font-bold text-gray-800 mb-2">
                    欢迎来到 BiuBiu English
                </h1>
                <p className="text-gray-600">
                    每一段都有一句能用的
                </p>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-indigo-100 text-sm mb-1">总期数</p>
                            <p className="text-4xl font-bold">{totalVideos}</p>
                        </div>
                        <BookOpen className="w-12 h-12 text-indigo-200" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-100 text-sm mb-1">已学习</p>
                            <p className="text-4xl font-bold">{learnedVideos}</p>
                        </div>
                        <CheckCircle className="w-12 h-12 text-green-200" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify之间">
                        <div>
                            <p className="text-orange-100 text-sm mb-1">未学习</p>
                            <p className="text-4xl font-bold">{unlearnedVideos}</p>
                        </div>
                        <Circle className="w-12 h-12 text-orange-200" />
                    </div>
                </div>
            </div>

            {/* 分类筛选 */}
            <div className="mb-6">
                <div className="flex flex-wrap gap-3">
                    {categories.map((category) => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${selectedCategory === category
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            {/* 视频列表标题 */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800">视频列表</h2>
            </div>

            {/* 视频卡片网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredVideos.map((video) => (
                    <VideoCard
                        key={video.id}
                        video={{
                            ...video,
                            isLearned: learnedVideoIds.includes(video.id),
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

export default Home;
