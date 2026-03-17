import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Heart, Settings, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

function Layout() {
    const location = useLocation();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        return localStorage.getItem('sidebarCollapsed') === 'true';
    });

    const toggleSidebar = () => {
        setSidebarCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('sidebarCollapsed', String(next));
            return next;
        });
    };

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
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {/* 左侧固定 Sidebar - 只在桌面端显示 */}
            <aside
                style={{
                    width: sidebarCollapsed ? '56px' : '180px',
                    transition: 'width 0.2s ease',
                    flexShrink: 0,
                }}
                className="hidden md:flex bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col shadow-sm overflow-hidden"
            >
                {/* Logo 区域 */}
                <div
                    className="border-b border-gray-200 dark:border-gray-700 flex items-center"
                    style={{
                        padding: sidebarCollapsed ? '14px 0' : '14px 16px',
                        justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                        minHeight: 64,
                    }}
                >
                    <div className="flex items-center gap-3" style={{ overflow: 'hidden', minWidth: 0 }}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                            <img src="/logo-192.png" alt="BiuBiu English" className="w-9 h-9 object-contain" />
                        </div>
                        {!sidebarCollapsed && (
                            <div style={{ minWidth: 0 }}>
                                <h1 className="text-sm font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap">BiuBiu English</h1>
                                <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">刷视频学英语</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 展开/收起按钮 - logo下方，始终可见 */}
                <button
                    onClick={toggleSidebar}
                    title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
                    className={`flex items-center w-full py-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-200 transition-all border-b border-gray-100 dark:border-gray-700 ${sidebarCollapsed ? 'justify-center' : 'justify-end pr-3'}`}
                >
                    {sidebarCollapsed
                        ? <ChevronRight className="w-3.5 h-3.5" />
                        : <ChevronLeft className="w-3.5 h-3.5" />
                    }
                </button>

                {/* 导航链接 */}
                <nav className="flex-1 p-2 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                title={sidebarCollapsed ? item.label : undefined}
                                className={clsx(
                                    'flex items-center rounded-lg transition-all duration-200',
                                    sidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-3',
                                    active
                                        ? 'bg-violet-400 text-white shadow-md'
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                                )}
                            >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                {!sidebarCollapsed && <span className="font-medium whitespace-nowrap">{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* 底部信息 */}
                {!sidebarCollapsed && (
                    <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 text-center pt-3">
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            © 2025 BiuBiu English
                        </p>
                        <a
                            href="https://beian.miit.gov.cn/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-400 dark:text-gray-500 hover:text-violet-500 transition-colors"
                        >
                            粤ICP备2025506915号-1
                        </a>
                    </div>
                )}
            </aside>

            {/* 右侧主内容区 */}
            <main className={`flex-1 ${location.pathname.startsWith('/episode/') ? 'md:overflow-y-auto' : 'overflow-y-auto'} ${location.pathname.startsWith('/episode/') ? '' : 'p-4 md:px-5 md:py-6 pb-20 md:pb-6'}`}>
                <Outlet />
            </main>

            {/* 底部导航栏 - 只在移动端显示 */}
            <nav className="mobile-bottom-nav flex md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50">
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
                                        ? 'text-violet-500 bg-violet-50 dark:bg-violet-900/30'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
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
