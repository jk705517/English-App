import { Clock, User, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

const renderLevel = (level) => {
    const num = parseInt(level);
    if (!isNaN(num) && num >= 1 && num <= 5) {
        return '★'.repeat(num);
    }
    return level || '';
};

function VideoCard({ video, onAuthorClick }) {
    return (
        <Link
            to={`/episode/${video.episode}`}
            className="group bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer"
        >
            {/* 封面图片 */}
            <div className="relative overflow-hidden aspect-video">
                <img
                    src={video.cover}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                {video.episode && (
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded font-medium">
                        第 {video.episode} 期
                    </div>
                )}
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {video.duration}
                </div>
                {/* 已学习遮罩 */}
                {video.isLearned && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#27ae60', fontSize: 16, fontWeight: 'bold' }}>
                            ✓
                        </div>
                    </div>
                )}
            </div>

            {/* 卡片内容 */}
            <div className="p-2 md:p-4">
                <h3 className="text-xs md:text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1 md:mb-2 line-clamp-2 group-hover:text-violet-500 transition-colors leading-snug">
                    {video.title}
                </h3>
                <div className="flex items-center justify-between text-xs md:text-sm text-gray-500 dark:text-gray-400 gap-1 md:gap-2">
                    <div className="flex items-center gap-0.5 md:gap-1 min-w-0 flex-1">
                        <User className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onAuthorClick && onAuthorClick(video.author);
                            }}
                            className="cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 hover:underline transition-colors truncate"
                        >
                            {video.author}
                        </span>
                    </div>
                    <div className="text-yellow-500 tracking-widest text-xs flex-shrink-0" style={{ fontSize: 10 }}>
                        {renderLevel(video.level)}
                    </div>
                </div>
                <div className="mt-1.5 md:mt-3 flex flex-wrap gap-1 md:gap-2">
                    <span className="inline-block bg-violet-100 dark:bg-violet-900/40 text-violet-500 dark:text-violet-400 px-2 py-0.5 md:px-3 md:py-1 rounded-full font-medium" style={{ fontSize: 11 }}>
                        {video.category}
                    </span>
                    {video.accent && (
                        <span className="inline-block bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 px-2 py-0.5 md:px-3 md:py-1 rounded-full font-medium" style={{ fontSize: 11 }}>
                            {video.accent}
                        </span>
                    )}
                </div>
                {/* 学习进度条 - 灰色底轨道始终可见 */}
                <div style={{ height: 3, background: '#e0e0e0', borderRadius: 2, marginTop: 10 }}>
                    <div style={{ height: '100%', borderRadius: 2, background: '#6B4FBB', width: video.isLearned ? '100%' : '0%', transition: 'width 0.3s' }}></div>
                </div>
            </div>
        </Link>
    );
}

export default VideoCard;
