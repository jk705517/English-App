import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { loadLearnedVideoIds } from '../services/progressService';
import { videoAPI } from '../services/api';
import VideoCard from '../components/VideoCard';
import { BookOpen, CheckCircle, Circle } from 'lucide-react';

function Home() {
    const { user } = useAuth();
    const [videos, setVideos] = useState([]);
    const [learnedVideoIds, setLearnedVideoIds] = useState([]);

    // 筛选状态
    const [filters, setFilters] = useState({
        category: '全部',
        level: '',
        accent: '全部',
        gender: '全部',
        author: '',
        sort: 'desc'
    });

    // 分类列表
    const categories = ['全部', '日常', '职场', '旅行', '时尚', '美食', '科技', '成长', '娱乐', '健康', '文化'];

    // 获取视频数据
    useEffect(() => {
        const fetchVideos = async () => {
            try {
                console.log('🚀 Fetching videos with filters:', filters);
                const result = await videoAPI.getAll(filters);
                console.log('📦 API result:', result);

                if (result.success) {
                    // 根据 sort 参数排序
                    const sortedVideos = (result.data || []).sort((a, b) =>
                        filters.sort === 'asc' ? a.episode - b.episode : b.episode - a.episode
                    );
                    setVideos(sortedVideos);
                } else {
                    console.error('Error fetching videos:', result.error);
                }
            } catch (error) {
                console.error('❌ Fetch error:', error);
            }
        };

        fetchVideos();
    }, [filters]);

    // 获取已学习状态（仅在用户变化时）
    useEffect(() => {
        const loadLearned = async () => {
            const learnedIds = await loadLearnedVideoIds(user);
            setLearnedVideoIds(learnedIds);
        };
        loadLearned();
    }, [user]);

    // 读取 URL 参数，初始化博主筛选
    const [searchParams, setSearchParams] = useSearchParams();
    useEffect(() => {
        const authorFromUrl = searchParams.get('author');
        if (authorFromUrl) {
            setFilters(prev => ({ ...prev, author: authorFromUrl }));
            // 清除 URL 参数，保持 URL 干净
            setSearchParams({}, { replace: true });
        }
    }, []); // 仅在组件首次加载时执行

    // 处理筛选变化
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    // 重置筛选
    const handleReset = () => {
        setFilters({
            category: '全部',
            level: '',
            accent: '全部',
            gender: '全部',
            author: '',
            sort: 'desc'
        });
    };

    // 点击博主筛选
    const handleAuthorClick = (authorName) => {
        setFilters(prev => ({ ...prev, author: authorName }));
    };

    // 检查是否有非默认筛选条件
    const hasActiveFilters = filters.level !== '' ||
        filters.accent !== '全部' ||
        filters.gender !== '全部' ||
        filters.author !== '' ||
        filters.sort !== 'desc';

    // 计算统计数据
    const totalVideos = videos.length;
    const learnedVideos = learnedVideoIds.length;
    const unlearnedVideos = totalVideos - learnedVideos;

    // 下拉框通用样式
    const selectClassName = "text-sm bg-white border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer";

    return (
        <div className="max-w-7xl mx-auto fade-in">
            {/* 页面标题 */}
            <div className="mb-8">
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
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-orange-100 text-sm mb-1">未学习</p>
                            <p className="text-4xl font-bold">{unlearnedVideos}</p>
                        </div>
                        <Circle className="w-12 h-12 text-orange-200" />
                    </div>
                </div>
            </div>

            {/* 分类筛选 */}
            <div className="mb-3">
                <div className="flex flex-wrap gap-3">
                    {categories.map((category) => (
                        <button
                            key={category}
                            onClick={() => handleFilterChange('category', category)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${filters.category === category
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            {/* 筛选栏 */}
            <div className="mb-6 flex flex-wrap items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                {/* 排序 */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">排序:</span>
                    <select
                        value={filters.sort}
                        onChange={(e) => handleFilterChange('sort', e.target.value)}
                        className={selectClassName}
                    >
                        <option value="desc">倒序</option>
                        <option value="asc">正序</option>
                    </select>
                </div>

                {/* 难度 */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">难度:</span>
                    <select
                        value={filters.level}
                        onChange={(e) => handleFilterChange('level', e.target.value)}
                        className={selectClassName}
                    >
                        <option value="">全部</option>
                        <option value="1">⭐</option>
                        <option value="2">⭐⭐</option>
                        <option value="3">⭐⭐⭐</option>
                        <option value="4">⭐⭐⭐⭐</option>
                        <option value="5">⭐⭐⭐⭐⭐</option>
                    </select>
                </div>

                {/* 口音 */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">口音:</span>
                    <select
                        value={filters.accent}
                        onChange={(e) => handleFilterChange('accent', e.target.value)}
                        className={selectClassName}
                    >
                        <option value="全部">全部</option>
                        <option value="美音">美音</option>
                        <option value="英音">英音</option>
                        <option value="澳音">澳音</option>
                        <option value="其他">其他</option>
                    </select>
                </div>

                {/* 性别 */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">性别:</span>
                    <select
                        value={filters.gender}
                        onChange={(e) => handleFilterChange('gender', e.target.value)}
                        className={selectClassName}
                    >
                        <option value="全部">全部</option>
                        <option value="男">男</option>
                        <option value="女">女</option>
                        <option value="混合">混合</option>
                    </select>
                </div>

                {/* 重置按钮 */}
                {hasActiveFilters && (
                    <button
                        onClick={handleReset}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium ml-2"
                    >
                        重置
                    </button>
                )}
            </div>

            {/* 博主筛选提示条 */}
            {filters.author && (
                <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-lg mb-4">
                    <span className="text-purple-600">📺 当前博主：{filters.author}</span>
                    <button
                        onClick={() => setFilters(prev => ({ ...prev, author: '' }))}
                        className="text-gray-500 hover:text-gray-700 ml-2"
                    >
                        ✕ 清除
                    </button>
                </div>
            )}

            {/* 视频列表标题 */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800">视频列表</h2>
            </div>

            {/* 视频卡片网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {videos.map((video) => (
                    <VideoCard
                        key={video.id}
                        video={{
                            ...video,
                            isLearned: learnedVideoIds.includes(video.id),
                        }}
                        onAuthorClick={handleAuthorClick}
                    />
                ))}
            </div>
        </div>
    );
}

export default Home;
