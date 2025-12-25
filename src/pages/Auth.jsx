import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [nickname, setNickname] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const { user, login, register, logout } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            let response;
            if (isRegister) {
                response = await register(phone, password, nickname);
            } else {
                response = await login(phone, password);
            }

            if (response.success) {
                setMessage(isRegister ? '注册成功' : '登录成功');
                setTimeout(() => navigate('/'), 1000);
            } else {
                setMessage(`错误: ${response.error}`);
            }
        } catch (error) {
            setMessage(`错误: ${error.message}`);
        }
        setLoading(false);
    };

    const handleLogout = () => {
        logout();
        setMessage('已退出登录');
        setPhone('');
        setPassword('');
        setNickname('');
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6 text-center">
                    {user ? '用户中心' : (isRegister ? '注册' : '登录')}
                </h1>

                {user ? (
                    <div className="text-center">
                        <p className="mb-2 text-green-600 font-medium">
                            当前用户: {user.phone}
                        </p>
                        {user.nickname && (
                            <p className="mb-4 text-gray-600">
                                昵称: {user.nickname}
                            </p>
                        )}
                        <button
                            onClick={handleLogout}
                            className="w-full bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition-colors"
                        >
                            退出登录
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                手机号
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="请输入手机号"
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-violet-400"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                密码
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-violet-400"
                                required
                            />
                        </div>
                        {isRegister && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    昵称（可选）
                                </label>
                                <input
                                    type="text"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-violet-400"
                                />
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-violet-400 text-white py-2 px-4 rounded hover:bg-violet-400 disabled:opacity-50 transition-colors"
                        >
                            {loading ? '处理中...' : (isRegister ? '注册' : '登录')}
                        </button>
                        <p className="text-center text-sm text-gray-600">
                            {isRegister ? '已有账号？' : '没有账号？'}
                            <button
                                type="button"
                                onClick={() => {
                                    setIsRegister(!isRegister);
                                    setMessage('');
                                }}
                                className="text-violet-500 hover:underline ml-1"
                            >
                                {isRegister ? '去登录' : '去注册'}
                            </button>
                        </p>
                    </form>
                )}

                {message && (
                    <div className={`mt-4 p-3 rounded text-center ${message.includes('错误') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {message}
                    </div>
                )}
            </div>
        </div>
    );
}
