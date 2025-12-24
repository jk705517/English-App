import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

function AboutPage() {
    return (
        <div className="max-w-3xl mx-auto">
            {/* 返回按钮 */}
            <div className="mb-6">
                <Link
                    to="/settings/more"
                    className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>返回</span>
                </Link>
            </div>

            {/* 关于内容 */}
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                {/* Logo */}
                <div className="mb-6">
                    <img
                        src="/logo-192.png"
                        alt="BiuBiu English Logo"
                        className="w-24 h-24 mx-auto"
                    />
                </div>

                {/* 应用名称 */}
                <h1 className="text-2xl font-bold text-gray-800 mb-2">
                    BiuBiu English
                </h1>

                {/* 版本号 */}
                <p className="text-gray-500 mb-6">
                    v1.0.0
                </p>

                {/* 简介 */}
                <p className="text-gray-600 mb-8 text-lg">
                    刷视频学英语，每一句都有用
                </p>

                {/* 分割线 */}
                <div className="border-t border-gray-200 my-6"></div>

                {/* 联系方式 */}
                <div className="mb-6">
                    <p className="text-sm text-gray-500 mb-1">联系我们</p>
                    <a
                        href="mailto:biubiuenglish@example.com"
                        className="text-indigo-600 hover:underline"
                    >
                        biubiuenglish@example.com
                    </a>
                </div>

                {/* 版权信息 */}
                <p className="text-sm text-gray-400">
                    © 2025 BiuBiu English
                </p>

                {/* 头像来源说明 */}
                <p className="text-xs text-gray-400 mt-8 text-center">
                    头像由 <a href="https://www.dicebear.com" target="_blank" rel="noopener noreferrer" className="underline">DiceBear</a> 提供
                </p>
            </div>
        </div>
    );
}

export default AboutPage;
