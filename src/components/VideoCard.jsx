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
                {video.isLearned && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded font-medium">
                        已学习
                    </div>
                )}
            </div>

            {/* 卡片内容 */}
            <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2 line-clamp-2 group-hover:text-violet-500 transition-colors">
                    {video.title}
                </h3>
                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onAuthorClick && onAuthorClick(video.author);
                            }}
                            className="cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 hover:underline transition-colors"
                        >
                            {video.author}
                        </span>
                    </div>
                    <div className="text-yellow-500 tracking-widest text-xs">
                        {renderLevel(video.level)}
                    </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-block bg-violet-100 dark:bg-violet-900/40 text-violet-500 dark:text-violet-400 text-xs px-3 py-1 rounded-full font-medium">
                        {video.category}
                    </span>
                    {video.accent && (
                        <span className="inline-block bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 text-xs px-3 py-1 rounded-full font-medium">
                            {video.accent}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
}

export default VideoCard;
