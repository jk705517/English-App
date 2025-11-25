import { mockVideos } from '../data/mockData';
import VideoCard from '../components/VideoCard';
import { BookOpen, CheckCircle, Circle } from 'lucide-react';

function Home() {
    const totalVideos = mockVideos.length;
    const learnedVideos = mockVideos.filter(v => v.isLearned).length;
    const unlearnedVideos = totalVideos - learnedVideos;

    return (
        <div className="max-w-7xl mx-auto">
            {/* 页面标题 */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-2">
                    欢迎来到 TEco Lab
                </h1>
                <p className="text-gray-600">
                    开始你的英语学习之旅
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

            {/* 视频列表标题 */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800">课程列表</h2>
            </div>

            {/* 视频卡片网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockVideos.map((video) => (
                    <VideoCard key={video.id} video={video} />
                ))}
            </div>
        </div>
    );
}

export default Home;
