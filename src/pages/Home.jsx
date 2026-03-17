import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { loadLearnedVideoIds } from '../services/progressService';
import { videoAPI, progressAPI } from '../services/api';
import VideoCard from '../components/VideoCard';
import { BookOpen, CheckCircle, Circle } from 'lucide-react';

function Home() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [videos, setVideos] = useState([]);
    const [learnedVideoIds, setLearnedVideoIds] = useState([]);
    const [recentLearning, setRecentLearning] = useState(null);

    const [studyFilter, setStudyFilter] = useState('all');

    const [filters, setFilters] = useState({
        category: '全部',
        level: '',
        accent: '全部',
        gender: '全部',
        author: '',
        sort: 'desc'
    });

    const categories = ['全部', '日常', '职场', '旅行', '时尚', '美食', '科技', '成长', '娱乐', '健康', '文化'];

    useEffect(() => {
        const fetchVideos = async () => {
            try {
                const result = await videoAPI.getAll(filters);
                if (result.success) {
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

    useEffect(() => {
        const loadLearned = async () => {
            const learnedIds = await loadLearnedVideoIds(user);
            setLearnedVideoIds(learnedIds);
        };
        loadLearned();
    }, [user]);

    useEffect(() => {
        const lastVisited = JSON.parse(localStorage.getItem('lastVisitedVideo') || 'null');
        if (lastVisited) {
            setRecentLearning(lastVisited);
            return;
        }
        if (user) {
            progressAPI.getRecentLearning()
                .then(res => {
                    if (res.success && res.data) {
                        setRecentLearning(res.data);
                    }
                })
                .catch(err => console.error('获取最近学习失败:', err));
        }
    }, [user]);

    const [searchParams, setSearchParams] = useSearchParams();
    useEffect(() => {
        const authorFromUrl = searchParams.get('author');
        if (authorFromUrl) {
            setFilters(prev => ({ ...prev, author: authorFromUrl }));
            searchParams.delete('author');
            setSearchParams(searchParams, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

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

    const handleAuthorClick = (authorName) => {
        setFilters(prev => ({ ...prev, author: authorName }));
    };

    const hasActiveFilters = filters.level !== '' ||
        filters.accent !== '全部' ||
        filters.gender !== '全部' ||
        filters.author !== '' ||
        filters.sort !== 'desc';

    const totalVideos = videos.length;
    const learnedVideos = learnedVideoIds.length;
    const unlearnedVideos = totalVideos - learnedVideos;
    const progressPercent = totalVideos > 0 ? Math.round(learnedVideos / totalVideos * 100) : 0;
    const circumference = 2 * Math.PI * 18;

    let filteredVideos = videos;
    if (studyFilter === 'learned') {
        filteredVideos = filteredVideos.filter(v => learnedVideoIds.includes(String(v.id)));
    } else if (studyFilter === 'unlearned') {
        filteredVideos = filteredVideos.filter(v => !learnedVideoIds.includes(String(v.id)));
    }

    // 手机端沿用原来的select样式
    const selectClassNameMobile = "text-sm bg-white dark:bg-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-500 cursor-pointer";
    // PC端紧凑select样式
    const selectClassNameDesktop = "text-xs bg-white dark:bg-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-500 cursor-pointer";

    return (
        <div className="fade-in md:max-w-[1600px] md:mx-auto">

            {/* ── PC端统计栏（升级版） ── */}
            <div className="hidden md:flex bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-4 items-center" style={{ padding: '14px 20px' }}>

                {/* 左侧组：环形进度 + 三个数字 */}
                <div className="flex items-center gap-4">
                    {/* 环形进度图 */}
                    <div style={{ position: 'relative', flexShrink: 0, width: 44, height: 44 }}>
                        <svg width="44" height="44" viewBox="0 0 44 44">
                            <circle cx="22" cy="22" r="18" fill="none" stroke="#e5e5e5" strokeWidth="3" />
                            <circle
                                cx="22" cy="22" r="18" fill="none"
                                stroke="#6B4FBB" strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={circumference * (1 - (totalVideos > 0 ? learnedVideos / totalVideos : 0))}
                                transform="rotate(-90 22 22)"
                                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                            />
                        </svg>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#6B4FBB', lineHeight: 1 }}>{progressPercent}%</span>
                        </div>
                    </div>

                    {/* 三个统计数字 */}
                    <div className="flex gap-1">
                        <div
                            onClick={() => setStudyFilter('all')}
                            className={`flex flex-col items-center cursor-pointer rounded-lg py-1.5 px-3 transition-colors ${studyFilter === 'all' ? 'bg-violet-50 dark:bg-violet-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                        >
                            <span className="font-bold text-violet-500" style={{ fontSize: 20, lineHeight: 1.2 }}>{totalVideos}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">总期数</span>
                        </div>
                        <div
                            onClick={() => setStudyFilter('learned')}
                            className={`flex flex-col items-center cursor-pointer rounded-lg py-1.5 px-3 transition-colors ${studyFilter === 'learned' ? 'bg-green-50 dark:bg-green-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                        >
                            <span className="font-bold text-green-500" style={{ fontSize: 20, lineHeight: 1.2 }}>{learnedVideos}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">已学习</span>
                        </div>
                        <div
                            onClick={() => setStudyFilter('unlearned')}
                            className={`flex flex-col items-center cursor-pointer rounded-lg py-1.5 px-3 transition-colors ${studyFilter === 'unlearned' ? 'bg-orange-50 dark:bg-orange-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                        >
                            <span className="font-bold text-orange-500" style={{ fontSize: 20, lineHeight: 1.2 }}>{unlearnedVideos}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">未学习</span>
                        </div>
                    </div>
                </div>

                {/* 继续学习按钮 - 靠右 */}
                {user && recentLearning && (
                    <div
                        onClick={() => navigate(`/episode/${recentLearning.episode}`)}
                        className="dark:bg-violet-900/30 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors cursor-pointer flex-shrink-0 flex items-center gap-2"
                        style={{ background: '#f5f3ff', borderRadius: 10, padding: '8px 16px', marginLeft: 'auto' }}
                    >
                        <span style={{ color: '#6B4FBB', fontSize: 13 }}>▶</span>
                        <span style={{ fontSize: 13, color: '#6B4FBB', fontWeight: 500, whiteSpace: 'nowrap' }}>
                            继续学习 · 第{recentLearning.episode}期
                        </span>
                    </div>
                )}
            </div>

            {/* ── 手机端统计栏（原样保留） ── */}
            <div className="flex md:hidden bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-4" style={{ padding: '12px 0' }}>
                <div
                    onClick={() => setStudyFilter('all')}
                    className={`flex-1 flex items-center justify-center gap-2 cursor-pointer transition-colors ${studyFilter === 'all' ? 'bg-violet-50 dark:bg-violet-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    style={{ borderRight: '1px solid #e5e7eb' }}
                >
                    <BookOpen className="w-5 h-5 text-violet-500" />
                    <span className="text-gray-600 dark:text-gray-300">总期数</span>
                    <span className="font-bold text-violet-500">{totalVideos}</span>
                </div>
                <div
                    onClick={() => setStudyFilter('learned')}
                    className={`flex-1 flex items-center justify-center gap-2 cursor-pointer transition-colors ${studyFilter === 'learned' ? 'bg-green-50 dark:bg-green-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    style={{ borderRight: '1px solid #e5e7eb' }}
                >
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-gray-600 dark:text-gray-300">已学习</span>
                    <span className="font-bold text-green-500">{learnedVideos}</span>
                </div>
                <div
                    onClick={() => setStudyFilter('unlearned')}
                    className={`flex-1 flex items-center justify-center gap-2 cursor-pointer transition-colors ${studyFilter === 'unlearned' ? 'bg-orange-50 dark:bg-orange-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                    <Circle className="w-5 h-5 text-orange-500" />
                    <span className="text-gray-600 dark:text-gray-300">未学习</span>
                    <span className="font-bold text-orange-500">{unlearnedVideos}</span>
                </div>
            </div>

            {/* 最近学习 - 仅手机端显示（PC端已合并至统计栏） */}
            {user && recentLearning && (
                <div
                    onClick={() => navigate(`/episode/${recentLearning.episode}`)}
                    className="md:hidden mx-4 mt-3 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg flex items-center justify-between cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-orange-500">▶</span>
                        <span className="text-gray-700 dark:text-gray-200 truncate">
                            最近学习 · 第{recentLearning.episode}期：{recentLearning.title}
                        </span>
                    </div>
                    <span className="text-gray-400 flex-shrink-0">→</span>
                </div>
            )}

            {/* 分类筛选 */}
            <div className="mb-3 md:mb-4">
                <div className="flex flex-wrap gap-3">
                    {categories.map((category) => (
                        <button
                            key={category}
                            onClick={() => handleFilterChange('category', category)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${filters.category === category
                                ? 'bg-violet-400 text-white shadow-md'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            {/* 筛选栏 */}
            <div className="mb-6 flex flex-wrap items-center gap-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500 dark:text-gray-400">排序:</span>
                    <select value={filters.sort} onChange={(e) => handleFilterChange('sort', e.target.value)} className="md:hidden text-sm bg-white dark:bg-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-500 cursor-pointer" >
                        <option value="desc">倒序</option>
                        <option value="asc">正序</option>
                    </select>
                    <select value={filters.sort} onChange={(e) => handleFilterChange('sort', e.target.value)} className={`hidden md:block ${selectClassNameDesktop}`}>
                        <option value="desc">倒序</option>
                        <option value="asc">正序</option>
                    </select>
                </div>

                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500 dark:text-gray-400">难度:</span>
                    <select value={filters.level} onChange={(e) => handleFilterChange('level', e.target.value)} className={`md:hidden ${selectClassNameMobile}`}>
                        <option value="">全部</option>
                        <option value="1">⭐</option>
                        <option value="2">⭐⭐</option>
                        <option value="3">⭐⭐⭐</option>
                        <option value="4">⭐⭐⭐⭐</option>
                        <option value="5">⭐⭐⭐⭐⭐</option>
                    </select>
                    <select value={filters.level} onChange={(e) => handleFilterChange('level', e.target.value)} className={`hidden md:block ${selectClassNameDesktop}`}>
                        <option value="">全部</option>
                        <option value="1">⭐</option>
                        <option value="2">⭐⭐</option>
                        <option value="3">⭐⭐⭐</option>
                        <option value="4">⭐⭐⭐⭐</option>
                        <option value="5">⭐⭐⭐⭐⭐</option>
                    </select>
                </div>

                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500 dark:text-gray-400">口音:</span>
                    <select value={filters.accent} onChange={(e) => handleFilterChange('accent', e.target.value)} className={`md:hidden ${selectClassNameMobile}`}>
                        <option value="全部">全部</option>
                        <option value="美音">美音</option>
                        <option value="英音">英音</option>
                        <option value="澳音">澳音</option>
                        <option value="其他">其他</option>
                    </select>
                    <select value={filters.accent} onChange={(e) => handleFilterChange('accent', e.target.value)} className={`hidden md:block ${selectClassNameDesktop}`}>
                        <option value="全部">全部</option>
                        <option value="美音">美音</option>
                        <option value="英音">英音</option>
                        <option value="澳音">澳音</option>
                        <option value="其他">其他</option>
                    </select>
                </div>

                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500 dark:text-gray-400">性别:</span>
                    <select value={filters.gender} onChange={(e) => handleFilterChange('gender', e.target.value)} className={`md:hidden ${selectClassNameMobile}`}>
                        <option value="全部">全部</option>
                        <option value="男">男</option>
                        <option value="女">女</option>
                        <option value="混合">混合</option>
                    </select>
                    <select value={filters.gender} onChange={(e) => handleFilterChange('gender', e.target.value)} className={`hidden md:block ${selectClassNameDesktop}`}>
                        <option value="全部">全部</option>
                        <option value="男">男</option>
                        <option value="女">女</option>
                        <option value="混合">混合</option>
                    </select>
                </div>

                {hasActiveFilters && (
                    <button onClick={handleReset} className="text-sm text-violet-500 hover:text-violet-600 font-medium ml-2">
                        重置
                    </button>
                )}
            </div>

            {/* 博主筛选提示条 */}
            {filters.author && (
                <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg mb-4">
                    <span className="text-purple-600 dark:text-purple-400">📺 当前博主：{filters.author}</span>
                    <button
                        onClick={() => setFilters(prev => ({ ...prev, author: '' }))}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 ml-2"
                    >
                        ✕ 清除
                    </button>
                </div>
            )}

            {/* 视频卡片网格 - PC端4列，手机端1列 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-4">
                {filteredVideos.map((video) => (
                    <VideoCard
                        key={video.id}
                        video={{
                            ...video,
                            isLearned: learnedVideoIds.includes(String(video.id)),
                        }}
                        onAuthorClick={handleAuthorClick}
                    />
                ))}
            </div>
        </div>
    );
}

export default Home;
