import { Clock, User, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

function VideoCard({ video }) {
    return (
        <Link
            to={`/video/${video.id}`}
            className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer"
        >
            {/* 封面图片 */}
            <div className="relative overflow-hidden aspect-video">
                <img
                    src={video.cover}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                {/* 时长标签 */}
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {video.duration}
                </div>
                {/* 学习状态标签 */}
                {video.isLearned && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded font-medium">
                        已学习
                    </div>
                )}
            </div>

            {/* 卡片内容 */}
            <div className="p-4">
                {/* 标题 */}
                <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                    {video.title}
                </h3>

                {/* 元信息 */}
                <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>{video.author}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                            <Star
                                key={i}
                                className={`w-3 h-3 ${i < video.difficulty ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                            />
                        ))}
                    </div>
                </div>

                {/* 分类标签 */}
                <div className="mt-3">
                    <span className="inline-block bg-indigo-100 text-indigo-700 text-xs px-3 py-1 rounded-full font-medium">
                        {video.category}
                    </span>
                </div>
            </div>
        </Link>
    );
}

export default VideoCard;
