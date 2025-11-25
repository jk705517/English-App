import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Heart, Settings, GraduationCap } from 'lucide-react';
import { clsx } from 'clsx';

function Layout() {
    const location = useLocation();

    const navItems = [
        { path: '/', icon: Home, label: '首页' },
        { path: '/favorites', icon: Heart, label: '收藏' },
        { path: '/settings', icon: Settings, label: '设置' },
    ];

    const isActive = (path) => {
        return location.pathname === path;
    };

    return (
        <div className="flex h-screen bg-gray-50">
            {/* 左侧固定 Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
                {/* Logo 区域 */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <GraduationCap className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-800">TEco Lab</h1>
                            <p className="text-xs text-gray-500">英语学习平台</p>
                        </div>
                    </div>
                </div>

                {/* 导航链接 */}
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={clsx(
                                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                                    active
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                )}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* 底部信息 */}
                <div className="p-4 border-t border-gray-200">
                    <p className="text-xs text-gray-400 text-center">
                        © 2025 TEco Lab
                    </p>
                </div>
            </aside>

            {/* 右侧主内容区 */}
            <main className="flex-1 overflow-y-auto p-8">
                <Outlet />
            </main>
        </div>
    );
}

export default Layout;
