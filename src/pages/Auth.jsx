import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { activateAPI, authAPI } from '../services/api';

export default function Auth() {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    // 弹窗状态
    const [showForgotAccount, setShowForgotAccount] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [showHowToRegister, setShowHowToRegister] = useState(false);

    // 忘记账号弹窗状态
    const [activateLink, setActivateLink] = useState('');
    const [foundPhone, setFoundPhone] = useState('');
    const [accountSearchLoading, setAccountSearchLoading] = useState(false);
    const [accountSearchError, setAccountSearchError] = useState('');

    // 忘记密码弹窗状态
    const [resetPhone, setResetPhone] = useState('');
    const [resetEmail, setResetEmail] = useState('');
    const [resetVerified, setResetVerified] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetError, setResetError] = useState('');
    const [resetSuccess, setResetSuccess] = useState(false);

    // 复制状态
    const [copied, setCopied] = useState(false);

    const { user, login, logout } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            const response = await login(phone, password);

            if (response.success) {
                setMessage('登录成功');
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
    };

    // 查询账号
    const handleSearchAccount = async () => {
        if (!activateLink.trim()) {
            setAccountSearchError('请输入链接');
            return;
        }

        // 从链接中提取 token
        const match = activateLink.match(/activate\/([a-zA-Z0-9-]+)/);
        if (!match) {
            setAccountSearchError('链接格式不正确');
            return;
        }

        const token = match[1];
        setAccountSearchLoading(true);
        setAccountSearchError('');
        setFoundPhone('');

        try {
            const response = await activateAPI.getInfo(token);
            if (response.success) {
                setFoundPhone(response.phone);
            } else {
                setAccountSearchError(response.message || '链接无效');
            }
        } catch (err) {
            setAccountSearchError(err.message || '查询失败');
        } finally {
            setAccountSearchLoading(false);
        }
    };

    // 验证手机号和邮箱
    const handleVerifyReset = async () => {
        if (!resetPhone.trim() || !resetEmail.trim()) {
            setResetError('请输入手机号和邮箱');
            return;
        }

        setResetLoading(true);
        setResetError('');

        try {
            const response = await authAPI.verifyReset({ phone: resetPhone, email: resetEmail });
            if (response.success && response.verified) {
                setResetVerified(true);
            } else {
                setResetError(response.message || '验证失败');
            }
        } catch (err) {
            setResetError(err.message || '验证失败');
        } finally {
            setResetLoading(false);
        }
    };

    // 重置密码
    const handleResetPassword = async () => {
        if (!newPassword.trim()) {
            setResetError('请输入新密码');
            return;
        }
        if (newPassword !== confirmPassword) {
            setResetError('两次输入的密码不一致');
            return;
        }

        setResetLoading(true);
        setResetError('');

        try {
            const response = await authAPI.resetPassword({
                phone: resetPhone,
                email: resetEmail,
                newPassword
            });
            if (response.success) {
                setResetSuccess(true);
                setTimeout(() => {
                    setShowForgotPassword(false);
                    // 重置所有状态
                    setResetPhone('');
                    setResetEmail('');
                    setResetVerified(false);
                    setNewPassword('');
                    setConfirmPassword('');
                    setResetSuccess(false);
                }, 2000);
            } else {
                setResetError(response.message || '重置失败');
            }
        } catch (err) {
            setResetError(err.message || '重置失败');
        } finally {
            setResetLoading(false);
        }
    };

    // 复制小红书号
    const handleCopyXHS = async () => {
        try {
            await navigator.clipboard.writeText('2931793559');
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('复制失败:', err);
        }
    };

    // 关闭忘记账号弹窗
    const closeForgotAccount = () => {
        setShowForgotAccount(false);
        setActivateLink('');
        setFoundPhone('');
        setAccountSearchError('');
    };

    // 关闭忘记密码弹窗
    const closeForgotPassword = () => {
        setShowForgotPassword(false);
        setResetPhone('');
        setResetEmail('');
        setResetVerified(false);
        setNewPassword('');
        setConfirmPassword('');
        setResetError('');
        setResetSuccess(false);
    };

    // 模态框组件
    const Modal = ({ show, onClose, children }) => {
        if (!show) return null;
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md relative" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl leading-none"
                    >
                        ×
                    </button>
                    {children}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6 text-center">
                    {user ? '用户中心' : '登录'}
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
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-violet-500 text-white py-2 px-4 rounded hover:bg-violet-600 disabled:opacity-50 transition-colors"
                        >
                            {loading ? '登录中...' : '登录'}
                        </button>

                        {/* 底部链接 */}
                        <div className="text-center text-sm text-gray-500 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowForgotAccount(true)}
                                className="text-violet-500 hover:underline"
                            >
                                忘记账号
                            </button>
                            <span className="mx-2">|</span>
                            <button
                                type="button"
                                onClick={() => setShowForgotPassword(true)}
                                className="text-violet-500 hover:underline"
                            >
                                忘记密码
                            </button>
                            <span className="mx-2">|</span>
                            <button
                                type="button"
                                onClick={() => setShowHowToRegister(true)}
                                className="text-violet-500 hover:underline"
                            >
                                如何注册？
                            </button>
                        </div>
                    </form>
                )}

                {message && (
                    <div className={`mt-4 p-3 rounded text-center ${message.includes('错误') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {message}
                    </div>
                )}
            </div>

            {/* 忘记账号弹窗 */}
            <Modal show={showForgotAccount} onClose={closeForgotAccount}>
                <div className="p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">忘记账号</h2>
                    <p className="text-gray-500 text-sm mb-4">请输入您的专属注册链接</p>

                    <input
                        type="text"
                        value={activateLink}
                        onChange={(e) => setActivateLink(e.target.value)}
                        placeholder="粘贴链接"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 mb-2"
                    />
                    <p className="text-xs text-gray-400 mb-4">
                        链接示例：https://biubiuenglish.com/activate/...
                    </p>

                    {accountSearchError && (
                        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
                            {accountSearchError}
                        </div>
                    )}

                    {foundPhone && (
                        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">您的账号（手机号）:</p>
                            <p className="text-lg font-mono font-bold text-gray-800">{foundPhone}</p>
                        </div>
                    )}

                    <button
                        onClick={handleSearchAccount}
                        disabled={accountSearchLoading}
                        className="w-full bg-violet-500 text-white py-2 px-4 rounded-lg hover:bg-violet-600 disabled:opacity-50 transition-colors"
                    >
                        {accountSearchLoading ? '查询中...' : '查询账号'}
                    </button>
                </div>
            </Modal>

            {/* 忘记密码弹窗 */}
            <Modal show={showForgotPassword} onClose={closeForgotPassword}>
                <div className="p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">忘记密码</h2>
                    <p className="text-gray-500 text-sm mb-4">请输入您的手机号和绑定邮箱进行验证</p>

                    {resetSuccess ? (
                        <div className="text-center py-8">
                            <div className="text-5xl mb-4">✅</div>
                            <p className="text-green-600 font-medium">密码重置成功！</p>
                        </div>
                    ) : !resetVerified ? (
                        <>
                            <div className="space-y-3 mb-4">
                                <input
                                    type="tel"
                                    value={resetPhone}
                                    onChange={(e) => setResetPhone(e.target.value)}
                                    placeholder="手机号"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                                />
                                <input
                                    type="email"
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                    placeholder="邮箱"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                                />
                            </div>

                            {resetError && (
                                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
                                    {resetError}
                                </div>
                            )}

                            <button
                                onClick={handleVerifyReset}
                                disabled={resetLoading}
                                className="w-full bg-violet-500 text-white py-2 px-4 rounded-lg hover:bg-violet-600 disabled:opacity-50 transition-colors"
                            >
                                {resetLoading ? '验证中...' : '验证'}
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded text-sm">
                                验证成功！请设置新密码
                            </div>

                            <div className="space-y-3 mb-4">
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="新密码"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                                />
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="确认密码"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                                />
                            </div>

                            {resetError && (
                                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
                                    {resetError}
                                </div>
                            )}

                            <button
                                onClick={handleResetPassword}
                                disabled={resetLoading}
                                className="w-full bg-violet-500 text-white py-2 px-4 rounded-lg hover:bg-violet-600 disabled:opacity-50 transition-colors"
                            >
                                {resetLoading ? '重置中...' : '重置密码'}
                            </button>
                        </>
                    )}
                </div>
            </Modal>

            {/* 如何注册弹窗 */}
            <Modal show={showHowToRegister} onClose={() => setShowHowToRegister(false)}>
                <div className="p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">如何注册？</h2>
                    <p className="text-gray-500 text-sm mb-6">
                        本网站仅对付费用户开放注册，请联系小红书店铺下单获取注册链接
                    </p>

                    <div className="space-y-4">
                        {/* 小红书店铺 */}
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                                <p className="text-sm text-gray-500">小红书店铺</p>
                                <p className="font-medium text-gray-800">BiuBiu英语</p>
                            </div>
                            <a
                                href="https://xhslink.com/m/2AOUeuRUVhZ"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-violet-500 hover:text-violet-600"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        </div>

                        {/* 小红书号 */}
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                                <p className="text-sm text-gray-500">小红书号</p>
                                <p className="font-mono font-medium text-gray-800">2931793559</p>
                            </div>
                            <button
                                onClick={handleCopyXHS}
                                className="px-3 py-1 text-sm text-violet-500 hover:bg-violet-50 rounded transition-colors"
                            >
                                {copied ? '已复制 ✓' : '复制'}
                            </button>
                        </div>

                        {/* 二维码 */}
                        <div className="text-center pt-2">
                            <p className="text-sm text-gray-500 mb-3">扫码关注小红书</p>
                            <img
                                src="/xiaohongshu-qr.png"
                                alt="小红书二维码"
                                className="w-40 h-40 mx-auto rounded-lg border border-gray-200"
                            />
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
