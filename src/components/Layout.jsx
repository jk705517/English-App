import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Heart, Settings, GraduationCap, BookOpen } from 'lucide-react';
import { clsx } from 'clsx';

function Layout() {
    const location = useLocation();

    const navItems = [
        { path: '/', icon: Home, label: '首页' },
        { path: '/favorites', icon: Heart, label: '收藏' },
        { path: '/notebooks', icon: BookOpen, label: '本子' },
        { path: '/settings', icon: Settings, label: '设置' },
    ];

    const isActive = (path) => {
        return location.pathname === path;
    };

    return (
        <div className="flex h-screen bg-gray-50">
            {/* 左侧固定 Sidebar - 只在桌面端显示 */}
            <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col shadow-sm">
                {/* Logo 区域 */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                            <img src="/logo-192.png" alt="BiuBiu English" className="w-10 h-10 object-contain" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-800">BiuBiu English</h1>
                            <p className="text-xs text-gray-500">刷视频学英语</p>
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
                                        ? 'bg-violet-400 text-white shadow-md'
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
                <div className="p-4 border-t border-gray-200 text-center">
                    <p className="text-xs text-gray-400">
                        © 2025 BiuBiu English
                    </p>
                    <a
                        href="https://beian.miit.gov.cn/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-400 hover:text-violet-500 transition-colors"
                    >
                        粤ICP备2025506915号-1
                    </a>
                </div>
            </aside>

            {/* 右侧主内容区 - 手机端添加底部内边距 */}
            {/* 视频详情页在移动端需要自己控制滚动，所以移除overflow */}
            <main className={`flex-1 ${location.pathname.startsWith('/episode/') ? 'md:overflow-y-auto' : 'overflow-y-auto'} p-4 md:p-8 pb-20 md:pb-8`}>
                <Outlet />
            </main>

            {/* 底部导航栏 - 只在移动端显示 */}
            <nav className="flex md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
                <div className="flex w-full">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={clsx(
                                    'flex-1 flex flex-col items-center justify-center py-3 transition-all duration-200',
                                    active
                                        ? 'text-violet-500 bg-violet-50'
                                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                )}
                            >
                                <Icon className={clsx(
                                    'w-6 h-6 mb-1',
                                    active ? 'stroke-[2.5]' : 'stroke-[2]'
                                )} />
                                <span className={clsx(
                                    'text-xs',
                                    active ? 'font-semibold' : 'font-medium'
                                )}>{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}

export default Layout;
