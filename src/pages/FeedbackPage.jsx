import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { feedbackAPI } from '../services/api';

function FeedbackPage() {
    const [type, setType] = useState('');
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    const feedbackTypes = [
        { value: 'suggestion', label: '功能建议' },
        { value: 'bug', label: 'Bug反馈' },
        { value: 'content', label: '内容问题' },
        { value: 'other', label: '其他' },
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!type) {
            alert('请选择反馈类型');
            return;
        }

        if (content.length < 10) {
            alert('详细描述至少需要10个字');
            return;
        }

        setSubmitting(true);
        try {
            const response = await feedbackAPI.submit({ type, content });
            if (response.success) {
                alert('感谢您的反馈！');
                navigate(-1);
            } else {
                alert('提交失败：' + (response.error || '未知错误'));
            }
        } catch (error) {
            alert('提交失败：' + error.message);
        } finally {
            setSubmitting(false);
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
                <h1 className="text-3xl font-bold text-gray-800">意见反馈</h1>
            </div>

            {/* 反馈表单 */}
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* 反馈类型 */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="font-semibold text-gray-800 mb-4">反馈类型</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {feedbackTypes.map((item) => (
                            <label
                                key={item.value}
                                className={`flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${type === item.value
                                        ? 'border-violet-400 bg-violet-50 text-violet-500'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="feedbackType"
                                    value={item.value}
                                    checked={type === item.value}
                                    onChange={(e) => setType(e.target.value)}
                                    className="sr-only"
                                />
                                <span className="font-medium">{item.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* 详细描述 */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="font-semibold text-gray-800 mb-4">详细描述</h3>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="请详细描述您的建议或问题（至少10个字）"
                        className="w-full h-40 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                    />
                    <div className="mt-2 text-sm text-gray-500 text-right">
                        {content.length} / 至少10字
                    </div>
                </div>

                {/* 提交按钮 */}
                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 p-4 bg-violet-400 text-white rounded-xl hover:bg-violet-400 disabled:opacity-50 transition-colors"
                >
                    <Send className="w-5 h-5" />
                    <span className="font-medium">{submitting ? '提交中...' : '提交反馈'}</span>
                </button>
            </form>
        </div>
    );
}

export default FeedbackPage;
