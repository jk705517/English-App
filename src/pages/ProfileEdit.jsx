import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { profileAPI, userAPI } from '../services/api';
import AVATAR_OPTIONS, { getAvatarUrl } from '../config/avatars';

function ProfileEdit() {
    const { user, updateUser, refreshUser } = useAuth();
    const navigate = useNavigate();

    const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || 'avatar1');
    const [nickname, setNickname] = useState(user?.nickname || '');
    const [email, setEmail] = useState(user?.email || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!nickname.trim()) {
            alert('请输入昵称');
            return;
        }

        setSaving(true);
        try {
            // 保存昵称和头像
            const response = await profileAPI.update({
                nickname: nickname.trim(),
                avatar: selectedAvatar
            });

            // 如果有邮箱，保存邮箱
            if (email.trim()) {
                try {
                    await userAPI.updateEmail(email.trim());
                } catch (emailError) {
                    console.error('邮箱保存失败:', emailError);
                }
            }

            if (response.success) {
                updateUser({
                    nickname: nickname.trim(),
                    avatar: selectedAvatar,
                    email: email.trim() || user?.email
                });
                // 刷新用户信息确保同步
                if (refreshUser) {
                    await refreshUser();
                }
                alert('保存成功！');
                navigate(-1);
            } else {
                alert('保存失败：' + (response.error || '未知错误'));
            }
        } catch (error) {
            alert('保存失败：' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            {/* 返回按钮和标题 */}
            <div className="mb-6">
                <Link
                    to="/settings/more"
                    className="inline-flex items-center gap-2 text-gray-600 hover:text-violet-500 transition-colors mb-4"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>返回</span>
                </Link>
                <h1 className="text-3xl font-bold text-gray-800">修改资料</h1>
            </div>

            {/* 头像选择 */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="font-semibold text-gray-800 mb-4">选择头像</h3>
                <div className="grid grid-cols-4 gap-3">
                    {AVATAR_OPTIONS.map((avatar) => (
                        <div
                            key={avatar.id}
                            onClick={() => setSelectedAvatar(avatar.id)}
                            className={`cursor-pointer rounded-full overflow-hidden border-2 ${selectedAvatar === avatar.id
                                ? 'border-violet-500 ring-2 ring-violet-300'
                                : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <img src={avatar.url} alt={avatar.id} className="w-16 h-16" />
                        </div>
                    ))}
                </div>
            </div>

            {/* 昵称输入 */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="font-semibold text-gray-800 mb-4">昵称</h3>
                <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="请输入昵称"
                    maxLength={20}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                <div className="mt-2 text-sm text-gray-500 text-right">
                    {nickname.length} / 20
                </div>
            </div>

            {/* 邮箱绑定 */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="font-semibold text-gray-800 mb-4">绑定邮箱</h3>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="请输入邮箱地址"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                <p className="mt-2 text-sm text-gray-500">
                    绑定邮箱后，可用于找回密码
                </p>
            </div>

            {/* 保存按钮 */}
            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 p-4 bg-violet-400 text-white rounded-xl hover:bg-violet-400 disabled:opacity-50 transition-colors"
            >
                <span className="font-medium">{saving ? '保存中...' : '保存修改'}</span>
            </button>
        </div>
    );
}

export default ProfileEdit;
