import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, ChevronRight, User, LogOut, Sun, Moon, Monitor } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getAvatarUrl } from '../config/avatars';

function Settings() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { theme, setTheme } = useTheme();

    const handleLogout = () => {
        if (window.confirm('确定要退出登录吗？')) {
            logout();
            navigate('/');
        }
    };

    const themeOptions = [
        { value: 'system', label: '跟随系统', icon: Monitor },
        { value: 'light', label: '浅色', icon: Sun },
        { value: 'dark', label: '深色', icon: Moon },
    ];

    return (
        <div className="max-w-3xl mx-auto">
            {/* 用户信息区域 */}
            <div
                onClick={() => user && navigate('/settings/profile')}
                className={`mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm flex items-center ${user ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md transition-all' : ''}`}
            >
                <div className="flex items-center gap-4 flex-1">
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
                        <h2 className="font-semibold text-gray-800 dark:text-gray-100 text-lg">
                            {user ? (user.nickname || user.phone) : '未登录'}
                        </h2>
                        {user && user.nickname && user.phone && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">{user.phone}</p>
                        )}
                        {!user && (
                            <a href="https://www.biubiuenglish.com/login" className="text-sm text-violet-500 hover:underline">
                                点击登录
                            </a>
                        )}
                    </div>
                </div>
                {user && <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />}
            </div>

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                    设置
                </h1>
            </div>

            {/* 功能卡片列表 */}
            <div className="space-y-4">
                {/* 主题切换 */}
                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/40 rounded-lg flex items-center justify-center">
                            {theme === 'dark' ? (
                                <Moon className="w-6 h-6 text-violet-500" />
                            ) : theme === 'light' ? (
                                <Sun className="w-6 h-6 text-violet-500" />
                            ) : (
                                <Monitor className="w-6 h-6 text-violet-500" />
                            )}
                        </div>
                        <h3 className="font-semibold text-gray-800 dark:text-gray-100">外观</h3>
                    </div>
                    <div className="flex gap-2">
                        {themeOptions.map(({ value, label, icon: Icon }) => (
                            <button
                                key={value}
                                onClick={() => setTheme(value)}
                                className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                    theme === value
                                        ? 'bg-violet-400 text-white shadow'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 学习统计入口 */}
                <Link
                    to="/review-stats"
                    className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/40 rounded-lg flex items-center justify-center">
                            <BarChart3 className="w-6 h-6 text-violet-500" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-800 dark:text-gray-100">学习统计（最近 7 天）</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">看看这几天有没有偷懒 😄</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-violet-500 transition-colors" />
                </Link>

                {/* 更多设置入口 */}
                <Link
                    to="/settings/more"
                    className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                            <span className="text-xl">⚙️</span>
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-800 dark:text-gray-100">更多设置</h3>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-violet-500 transition-colors" />
                </Link>
            </div>

            {/* 退出登录按钮 */}
            {user && (
                <div className="mt-8">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 transition-colors"
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
