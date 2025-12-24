import { Link } from 'react-router-dom';
import { ArrowLeft, Monitor, MessageSquare, User, Info, ChevronRight } from 'lucide-react';

function MoreSettings() {
    const menuItems = [
        { icon: Monitor, label: '设备管理', path: '/settings/devices' },
        { icon: MessageSquare, label: '意见反馈', path: '/settings/feedback' },
        { icon: User, label: '修改资料', path: '/settings/profile' },
        { icon: Info, label: '关于BiuBiu English', path: '/settings/about' },
    ];

    return (
        <div className="max-w-3xl mx-auto">
            {/* 返回按钮和标题 */}
            <div className="mb-6">
                <Link
                    to="/settings"
                    className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>返回</span>
                </Link>
                <h1 className="text-3xl font-bold text-gray-800">更多设置</h1>
            </div>

            {/* 设置项列表 */}
            <div className="space-y-3">
                {menuItems.map((item, index) => {
                    const IconComponent = item.icon;
                    return (
                        <Link
                            key={index}
                            to={item.path}
                            className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                                    <IconComponent className="w-6 h-6 text-indigo-600" />
                                </div>
                                <h3 className="font-semibold text-gray-800">{item.label}</h3>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

export default MoreSettings;
