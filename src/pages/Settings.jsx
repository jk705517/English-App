import { Link } from 'react-router-dom';
import { BarChart3, ChevronRight } from 'lucide-react';

function Settings() {
    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">
                    设置
                </h1>
                <p className="text-gray-500">
                    管理你的学习偏好和数据
                </p>
            </div>

            {/* 功能卡片列表 */}
            <div className="space-y-4">
                {/* 学习统计入口 */}
                <Link
                    to="/review-stats"
                    className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <BarChart3 className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-800">学习统计（最近 7 天）</h3>
                            <p className="text-sm text-gray-500">看看这几天有没有偷懒 😄</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                </Link>

                {/* 占位：未来功能 */}
                <div className="p-4 bg-white rounded-xl shadow-sm opacity-60">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                            <span className="text-xl">⚙️</span>
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-800">更多设置</h3>
                            <p className="text-sm text-gray-500">字幕模式、自动循环等功能即将上线...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings;
