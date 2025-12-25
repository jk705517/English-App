import { useState } from 'react';
import { adminAPI } from '../services/api';

export default function AdminGenerateLink() {
    const [adminPassword, setAdminPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [results, setResults] = useState([]);
    const [copiedIndex, setCopiedIndex] = useState(null);

    const handleGenerate = async (e) => {
        e.preventDefault();

        if (!adminPassword.trim()) {
            setError('请输入管理员密码');
            return;
        }

        if (!phone.trim()) {
            setError('请输入手机号');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await adminAPI.generateLink(phone.trim(), adminPassword.trim());
            if (response.success) {
                setResults(prev => [{
                    link: response.link,
                    phone: response.phone,
                    password: response.password,
                    createdAt: new Date().toLocaleString()
                }, ...prev]);
                setPhone('');
            } else {
                setError(response.message || '生成失败');
            }
        } catch (err) {
            setError(err.message || '生成失败');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async (text, index) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch (err) {
            console.error('复制失败:', err);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-2xl font-bold mb-6 text-gray-800">生成注册链接</h1>

                {/* 生成表单 */}
                <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                    <form onSubmit={handleGenerate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                管理员密码
                            </label>
                            <input
                                type="password"
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                                placeholder="请输入管理员密码"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                手机号
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="请输入手机号"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded bg-red-100 text-red-700 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-violet-500 text-white py-3 px-4 rounded-lg hover:bg-violet-600 disabled:opacity-50 transition-colors font-medium"
                        >
                            {loading ? '生成中...' : '生成注册链接'}
                        </button>
                    </form>
                </div>

                {/* 结果列表 */}
                {results.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-medium text-gray-700">已生成的链接</h2>
                        {results.map((result, index) => (
                            <div key={index} className="bg-white p-6 rounded-lg shadow-md">
                                <div className="text-xs text-gray-400 mb-3">{result.createdAt}</div>

                                <div className="space-y-3">
                                    {/* 注册链接 */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-500 mb-1">
                                            注册链接
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={result.link}
                                                readOnly
                                                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm font-mono text-gray-700"
                                            />
                                            <button
                                                onClick={() => handleCopy(result.link, `link-${index}`)}
                                                className="px-4 py-2 bg-violet-100 text-violet-600 rounded hover:bg-violet-200 transition-colors text-sm font-medium whitespace-nowrap"
                                            >
                                                {copiedIndex === `link-${index}` ? '已复制 ✓' : '复制'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* 手机号 */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-500 mb-1">
                                                手机号（账号）
                                            </label>
                                            <p className="font-mono text-gray-800">{result.phone}</p>
                                        </div>
                                        <button
                                            onClick={() => handleCopy(result.phone, `phone-${index}`)}
                                            className="px-3 py-1 text-violet-500 hover:bg-violet-50 rounded text-sm"
                                        >
                                            {copiedIndex === `phone-${index}` ? '已复制' : '复制'}
                                        </button>
                                    </div>

                                    {/* 密码 */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-500 mb-1">
                                                初始密码
                                            </label>
                                            <p className="font-mono text-gray-800">{result.password}</p>
                                        </div>
                                        <button
                                            onClick={() => handleCopy(result.password, `pwd-${index}`)}
                                            className="px-3 py-1 text-violet-500 hover:bg-violet-50 rounded text-sm"
                                        >
                                            {copiedIndex === `pwd-${index}` ? '已复制' : '复制'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
