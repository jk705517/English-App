import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const VocabDetail = () => {
    const { word } = useParams();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                <h1 className="text-3xl font-bold text-indigo-700 mb-4">{word}</h1>
                <p className="text-gray-600 mb-6">这里是单词 "{word}" 的详细学习卡片页面。</p>
                <div className="p-4 bg-yellow-50 text-yellow-700 rounded-lg mb-6">
                    🚧 功能开发中...
                </div>
                <button
                    onClick={() => navigate(-1)}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                    返回
                </button>
            </div>
        </div>
    );
};

export default VocabDetail;
