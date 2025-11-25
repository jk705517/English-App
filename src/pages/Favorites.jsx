import { useState, useEffect } from 'react';
import { mockVideos } from '../data/mockData';
import VideoCard from '../components/VideoCard';
import { Heart } from 'lucide-react';

function Favorites() {
    const [favoriteVideoIds, setFavoriteVideoIds] = useState([]);
    const [learnedVideoIds, setLearnedVideoIds] = useState([]);

    // 从 localStorage 读取收藏和已学习的视频 ID 列表
    useEffect(() => {
        const storedFavoriteIds = JSON.parse(localStorage.getItem('favoriteVideoIds') || '[]');
        const storedLearnedIds = JSON.parse(localStorage.getItem('learnedVideoIds') || '[]');
        setFavoriteVideoIds(storedFavoriteIds);
        setLearnedVideoIds(storedLearnedIds);
    }, []);

    // 根据 ID 从 mockVideos 中筛选出已收藏的视频
    const favoriteVideos = mockVideos.filter(video => favoriteVideoIds.includes(video.id));

    return (
        <div className="max-w-7xl mx-auto">
            {/* 页面标题 */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                    <Heart className="w-10 h-10 text-red-500 fill-current" />
                    我的收藏
                </h1>
                <p className="text-gray-600">
                    {favoriteVideos.length > 0
                        ? `你已收藏 ${favoriteVideos.length} 个视频`
                        : '还没有收藏视频哦'}
                </p>
            </div>

            {/* 视频卡片网格或空状态 */}
            {favoriteVideos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {favoriteVideos.map((video) => (
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
