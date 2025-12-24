import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { profileAPI } from '../services/api';

function ProfileEdit() {
    const { user, updateUser } = useAuth();
    const navigate = useNavigate();

    // 预设头像颜色
    const avatarColors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
    ];

    const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || 'avatar1');
    const [nickname, setNickname] = useState(user?.nickname || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!nickname.trim()) {
            alert('请输入昵称');
            return;
        }

        setSaving(true);
        try {
            const response = await profileAPI.update({
                nickname: nickname.trim(),
                avatar: selectedAvatar
            });
            if (response.success) {
                updateUser({ nickname: nickname.trim(), avatar: selectedAvatar });
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
                    className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>返回</span>
                </Link>
                <h1 className="text-3xl font-bold text-gray-800">修改资料</h1>
            </div>

            {/* 头像选择 */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="font-semibold text-gray-800 mb-4">选择头像</h3>
                <div className="grid grid-cols-4 gap-4">
                    {avatarColors.map((color, index) => {
                        const avatarId = `avatar${index + 1}`;
                        const isSelected = selectedAvatar === avatarId;
                        return (
                            <button
                                key={avatarId}
                                onClick={() => setSelectedAvatar(avatarId)}
                                className={`relative aspect-square rounded-full transition-transform hover:scale-105 ${isSelected ? 'ring-4 ring-indigo-600 ring-offset-2' : ''
                                    }`}
                                style={{ backgroundColor: color }}
                            >
                                {isSelected && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Check className="w-8 h-8 text-white drop-shadow-lg" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="mt-2 text-sm text-gray-500 text-right">
                    {nickname.length} / 20
                </div>
            </div>

            {/* 保存按钮 */}
            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 p-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
                <span className="font-medium">{saving ? '保存中...' : '保存修改'}</span>
            </button>
        </div>
    );
}

export default ProfileEdit;
