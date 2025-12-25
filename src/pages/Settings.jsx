import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, ChevronRight, User, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarUrl } from '../config/avatars';

function Settings() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        if (window.confirm('确定要退出登录吗？')) {
            logout();
            navigate('/');
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            {/* 用户信息区域 */}
            <div className="mb-6 p-4 bg-white rounded-xl shadow-sm">
                <div className="flex items-center gap-4">
                    {user?.avatar ? (
                        <img
                            src={getAvatarUrl(user?.avatar)}
                            alt="头像"
                            className="w-12 h-12 rounded-full bg-gray-100"
                        />
                    ) : (
                        <div className="w-14 h-14 bg-gradient-to-br from-violet-300 to-purple-500 rounded-full flex items-center justify-center">
                            <User className="w-7 h-7 text-white" />
                        </div>
                    )}
                    <div>
                        <h2 className="font-semibold text-gray-800 text-lg">
                            {user ? (user.nickname || user.phone) : '未登录'}
                        </h2>
                        {user && user.nickname && user.phone && (
                            <p className="text-sm text-gray-500">{user.phone}</p>
                        )}
                        {!user && (
                            <a href="https://www.biubiuenglish.com/login" className="text-sm text-violet-500 hover:underline">
                                点击登录
                            </a>
                        )}
                    </div>
                </div>
            </div>

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
                        <div className="w-12 h-12 bg-violet-100 rounded-lg flex items-center justify-center">
                            <BarChart3 className="w-6 h-6 text-violet-500" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-800">学习统计（最近 7 天）</h3>
                            <p className="text-sm text-gray-500">看看这几天有没有偷懒 😄</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-violet-500 transition-colors" />
                </Link>

                {/* 更多设置入口 */}
                <Link
                    to="/settings/more"
                    className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                            <span className="text-xl">⚙️</span>
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-800">更多设置</h3>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-violet-500 transition-colors" />
                </Link>
            </div>

            {/* 退出登录按钮 - 仅登录状态显示 */}
            {user && (
                <div className="mt-8">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 p-4 bg-white rounded-xl shadow-sm border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">退出登录</span>
                    </button>
                </div>
            )}
        </div>
    );
}

export default Settings;
