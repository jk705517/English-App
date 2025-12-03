import { useState, useEffect } from 'react';
import VideoCard from '../components/VideoCard';
import { Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { progressService } from '../services/progressService';
import { favoritesService } from '../services/favoritesService';
import { supabase } from '../services/supabaseClient';

function Favorites() {
    const { user } = useAuth();
    const [favoriteVideoIds, setFavoriteVideoIds] = useState([]);
    const [learnedVideoIds, setLearnedVideoIds] = useState([]);
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 从 Supabase/localStorage 读取收藏和已学习的视频 ID 列表
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                setError(null);

                const storedFavoriteIds = await favoritesService.loadFavoriteVideoIds(user);
                const loadedLearnedIds = await progressService.loadLearnedVideoIds(user);

                setFavoriteVideoIds(storedFavoriteIds);
                setLearnedVideoIds(loadedLearnedIds);

                // 如果有收藏的视频，从 Supabase 获取视频详情
                if (storedFavoriteIds.length > 0) {
                    const { data, error: fetchError } = await supabase
                        .from('videos')
                        .select('*')
                        .in('id', storedFavoriteIds);

                    if (fetchError) {
                        console.error('Error fetching favorite videos:', fetchError);
                        setError('加载收藏视频失败，请重试');
                        setVideos([]);
                    } else {
                        // 按照 favoriteIds 的顺序排序视频（最近收藏的在前）
                        const sortedVideos = storedFavoriteIds
                            .map(id => data.find(video => video.id === id))
                            .filter(Boolean); // 过滤掉可能不存在的视频

                        setVideos(sortedVideos);
                    }
                } else {
                    setVideos([]);
                }
            } catch (err) {
                console.error('Error loading favorites:', err);
                setError('加载收藏失败，请重试');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [user]);

    return (
        <div className="max-w-7xl mx-auto">
            {/* 页面标题 */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                    <Heart className="w-10 h-10 text-red-500 fill-current" />
                    我的收藏
                </h1>
                <p className="text-gray-600">
                    {loading
                        ? '正在加载...'
                        : videos.length > 0
                            ? `你已收藏 ${videos.length} 个视频`
                            : '还没有收藏视频哦'}
                </p>
            </div>

            {/* 错误状态 */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-red-600">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-2 text-red-600 underline hover:text-red-700"
                    >
                        刷新页面重试
                    </button>
                </div>
            )}

            {/* 加载状态 */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                    <p className="text-gray-500">正在加载收藏...</p>
                </div>
            ) : videos.length > 0 ? (
                /* 视频卡片网格 */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {videos.map((video) => (
                        <VideoCard
                            key={video.id}
                            video={{
                                ...video,
                                isLearned: learnedVideoIds.includes(video.id)
                            }}
                        />
                    ))}
                </div>
            ) : (
                /* 空状态 */
                <div className="flex flex-col items-center justify-center py-20">
                    <Heart className="w-24 h-24 text-gray-300 mb-4" />
                    <p className="text-xl text-gray-500 mb-2">还没有收藏视频哦</p>
                    <p className="text-gray-400">在视频详情页点击 ❤️ 按钮即可收藏</p>
                </div>
            )}
        </div>
    );
}

export default Favorites;
