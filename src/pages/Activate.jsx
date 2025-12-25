import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { activateAPI } from '../services/api';

export default function Activate() {
    const { token } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [activating, setActivating] = useState(false);
    const [error, setError] = useState('');
    const [linkInfo, setLinkInfo] = useState(null);
    const [activated, setActivated] = useState(false);

    useEffect(() => {
        const fetchLinkInfo = async () => {
            try {
                const response = await activateAPI.getInfo(token);
                if (response.success) {
                    setLinkInfo(response);
                } else {
                    setError(response.message || '链接无效');
                }
            } catch (err) {
                setError(err.message || '获取链接信息失败');
            } finally {
                setLoading(false);
            }
        };

        fetchLinkInfo();
    }, [token]);

    const handleActivate = async () => {
        setActivating(true);
        setError('');

        try {
            const response = await activateAPI.activate(token);
            if (response.success) {
                setActivated(true);
            } else {
                setError(response.message || '激活失败');
            }
        } catch (err) {
            setError(err.message || '激活失败');
        } finally {
            setActivating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
                <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
                    <div className="text-gray-500">加载中...</div>
                </div>
            </div>
        );
    }

    if (error && !linkInfo) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
                <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
                    <div className="text-6xl mb-4">❌</div>
                    <h1 className="text-2xl font-bold mb-4 text-gray-800">链接无效</h1>
                    <p className="text-red-500 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="text-violet-500 hover:underline"
                    >
                        返回登录
                    </button>
                </div>
            </div>
        );
    }

    if (activated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
                <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
                    <div className="text-6xl mb-4">✅</div>
                    <h1 className="text-2xl font-bold mb-4 text-green-600">账号激活成功</h1>
                    <p className="text-gray-600 mb-6">您现在可以使用账号密码登录了</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full bg-violet-500 text-white py-3 px-4 rounded-lg hover:bg-violet-600 transition-colors font-medium"
                    >
                        去登录
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">账号激活</h1>

                <div className="space-y-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                            手机号（账号）
                        </label>
                        <p className="text-lg font-mono text-gray-800">{linkInfo?.phone}</p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                            初始密码
                        </label>
                        <p className="text-lg font-mono text-gray-800">{linkInfo?.password}</p>
                    </div>
                </div>

                <p className="text-sm text-gray-500 mb-6 text-center">
                    请妥善保存您的账号密码，激活后即可登录使用
                </p>

                {error && (
                    <div className="mb-4 p-3 rounded bg-red-100 text-red-700 text-center text-sm">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleActivate}
                    disabled={activating}
                    className="w-full bg-violet-500 text-white py-3 px-4 rounded-lg hover:bg-violet-600 disabled:opacity-50 transition-colors font-medium"
                >
                    {activating ? '激活中...' : '激活账号'}
                </button>
            </div>
        </div>
    );
}
