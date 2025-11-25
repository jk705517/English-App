export const mockVideos = [
    {
        id: 1,
        title: "How language shapes the way we think",
        videoUrl: "https://www.youtube.com/watch?v=RKK7wGAYP6k",
        duration: "14:03",
        author: "Lera Boroditsky",
        level: "⭐⭐⭐⭐",
        isLearned: false,
        // 这是一个人工校准过时间轴的真实片段
        transcript: [
            { start: 12.5, text: "So, I'll be speaking to you using language ...", cn: "所以，我将用语言来跟你们讲话……" },
            { start: 16.0, text: "... because I can.", cn: "……因为我能做到。" },
            { start: 17.5, text: "This is one these magical abilities that we humans have.", cn: "这是我们人类拥有的神奇能力之一。" },
            { start: 22.0, text: "We can transmit really complicated thoughts to one another.", cn: "我们可以向彼此传递非常复杂的思想。" },
            { start: 27.0, text: "So what I'm doing right now is, I'm making sounds with my mouth ...", cn: "所以我现在做的是，用我的嘴巴发出声音……" },
            { start: 31.5, text: "... as I'm exhaling. I'm making tones and hisses and puffs.", cn: "……在我呼气的时候。发出音调、嘶嘶声和气流声。" },
            { start: 37.0, text: "And those are creating air vibrations in the air.", cn: "这些正在空气中产生振动。" }
        ],
        vocab: [
            { word: "Transmit", type: "v.", meaning: "传输，传递" },
            { word: "Complicated", type: "adj.", meaning: "复杂的" },
            { word: "Vibration", type: "n.", meaning: "振动" }
        ]
    },
    // 占位数据
    { id: 2, title: "Daily Conversation", videoUrl: "", duration: "10:00", author: "TEco Lab", level: "⭐⭐", isLearned: true },
    { id: 3, title: "Business English", videoUrl: "", duration: "15:30", author: "TEco Lab", level: "⭐⭐⭐", isLearned: false },
    { id: 4, title: "Travel Vlog", videoUrl: "", duration: "08:20", author: "TEco Lab", level: "⭐⭐", isLearned: false },
    { id: 5, title: "Tech News", videoUrl: "", duration: "12:45", author: "TEco Lab", level: "⭐⭐⭐⭐", isLearned: false },
    { id: 6, title: "Cooking Class", videoUrl: "", duration: "20:10", author: "TEco Lab", level: "⭐", isLearned: true },
];