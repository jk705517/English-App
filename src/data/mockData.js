export const mockVideos = [
    {
        id: 1,
        title: "How language shapes the way we think",
        cover: "/cover.jpg",
        videoUrl: "https://biubiu-assets.oss-cn-hangzhou.aliyuncs.com/demo.mp4",
        duration: "14:03",
        author: "Lera Boroditsky",
        level: "⭐⭐⭐⭐",
        difficulty: 4,
        category: "成长",
        isLearned: false,
        // 调整后的时间轴，适配本地测试视频
        transcript: [
            { start: 0, text: "So, I'll be speaking to you using language ...", cn: "所以，我将用语言来跟你们讲话……" },
            { start: 3, text: "... because I can.", cn: "……因为我能做到。" },
            { start: 5, text: "This is one these magical abilities that we humans have.", cn: "这是我们人类拥有的神奇能力之一。" },
            { start: 9, text: "We can transmit really complicated thoughts to one another.", cn: "我们可以向彼此传递非常复杂的思想。" },
            { start: 13, text: "So what I'm doing right now is, I'm making sounds with my mouth ...", cn: "所以我现在做的是，用我的嘴巴发出声音……" },
            { start: 17, text: "... as I'm exhaling. I'm making tones and hisses and puffs.", cn: "……在我呼气的时候。发出音调、嘶嘶声和气流声。" },
            { start: 21, text: "And those are creating air vibrations in the air.", cn: "这些正在空气中产生振动。" }
        ],
        vocab: [
            { word: "Transmit", type: "v.", meaning: "传输，传递" },
            { word: "Complicated", type: "adj.", meaning: "复杂的" },
            { word: "Vibration", type: "n.", meaning: "振动" }
        ]
    },
    {
        id: 2,
        title: "一个让我做回自己的地方",
        cover: "https://biubiu-assets.oss-cn-hangzhou.aliyuncs.com/%E5%B0%81%E9%9D%A2118.png",
        videoUrl: "https://biubiu-assets.oss-cn-hangzhou.aliyuncs.com/%E6%97%A0%E5%AD%97%E5%B9%95%E8%A7%86%E9%A2%91118.mp4",
        duration: "01:05",
        author: "BiuBiu Pick",
        level: "⭐⭐⭐",
        difficulty: 3,
        category: "旅行",
        isLearned: false,
        transcript: [
            { start: 0.24, text: "There's something about being here", cn: "在这里有一种特别的感觉" },
            { start: 1.5, text: "that makes me feel beautiful and free.", cn: "让我感到美丽而自由。" },
            {
                start: 5.07, text: "Maybe it's the warmth in the air or how the", cn: "也许是空气中的温暖，或者是", highlights: [
                    { word: "warmth", phonetic: "/wɔːrmθ/", type: "n.", meaning: "温暖", definition: "The quality, state, or sensation of being warm", example: "We enjoyed the warmth of the sun.", exampleCn: "我们享受着阳光的温暖。" }
                ]
            },
            { start: 7.65, text: "food tastes like it was made slowly with care.", cn: "食物尝起来像是用心慢慢制作的。" },
            { start: 11.16, text: "Maybe it's just the way people move.", cn: "也许只是人们行动的方式。" },
            { start: 12.945, text: "Slower, more open, whatever it is, it", cn: "更慢，更开放，无论是什么，" },
            { start: 17.115, text: "makes me feel like I can finally breathe.", cn: "让我觉得我终于可以呼吸了。" },
            { start: 20.925, text: "I'm remembering a version of", cn: "我想起了一个" },
            { start: 23.025, text: "myself I haven't seen in a while.", cn: "我好久没见过的自己。" },
            { start: 25.995, text: "The one who lets her curl stay wild,", cn: "那个让她的卷发自然蓬松的自己，" },
            { start: 28.845, text: "throws on a linen dress and walks", cn: "穿上亚麻裙，随意走着，" },
            { start: 31.485, text: "with no plan, no need to impress,", cn: "没有计划，不需要取悦任何人，" },
            { start: 35.085, text: "but look at this, it's stunning.", cn: "但看看这个，真是令人惊叹。" },
            { start: 37.035, text: "Seriously, wow.", cn: "真的，哇。" },
            { start: 38.69, text: "I will add there are not enough trash", cn: "我还要补充一点，这里垃圾桶不够多，" },
            { start: 40.55, text: "cans after I've been holding onto", cn: "因为我已经拿着一张纸巾" },
            { start: 42.86, text: "a tissue for the past 20 minutes.", cn: "20分钟了。" },
            { start: 45.62, text: "Maybe.", cn: "也许吧。" },
            { start: 46.58, text: "Stunning.", cn: "令人惊叹。" },
            { start: 48.199, text: "I feel so happy.", cn: "我感到非常开心。" },
            { start: 49.79, text: "It's strange, isn't it?", cn: "这很奇怪，不是吗？" },
            { start: 52.16, text: "How a place I've never been can make me feel", cn: "一个我从未去过的地方竟能让我感到" },
            {
                start: 55.4, text: "more embraced and home the place I'm supposed", cn: "比我应该属于的地方更被拥抱，", highlights: [
                    { word: "embraced", phonetic: "/ɪmˈbreɪst/", type: "adj./v.", meaning: "被拥抱的；拥抱", definition: "Hold someone closely in one's arms; accept willingly", example: "She embraced the new culture.", exampleCn: "她欣然接受了新文化。" }
                ]
            },
            { start: 59.15, text: "to belong to, but where everything feels a", cn: "但在那里一切都显得" },
            {
                start: 61.91, text: "little more polished, a little more performed.", cn: "更精致，更像在表演。", highlights: [
                    { word: "polished", phonetic: "/ˈpɑːlɪʃt/", type: "adj.", meaning: "精致的，完美的", definition: "Refined, sophisticated, or elegant", example: "He gave a polished performance.", exampleCn: "他的表演很完美。" },
                    { word: "performed", phonetic: "/pərˈfɔːrmd/", type: "adj./v.", meaning: "表演的；做作的", definition: "Carried out or executed; presented in a theatrical manner", example: "The dance was beautifully performed.", exampleCn: "舞蹈表演得很美。" }
                ]
            }
        ],
        vocab: [
            { word: "embraced", type: "adj.", meaning: "被拥抱的，被接纳的" },
            { word: "polished", type: "adj.", meaning: "精致的，完美的" },
            { word: "performed", type: "adj.", meaning: "表演的，做作的" }
        ]
    },
    { id: 3, title: "Business English", cover: "/cover.jpg", videoUrl: "", duration: "15:30", author: "TEco Lab", level: "⭐⭐⭐", difficulty: 3, category: "职场", isLearned: false },
    { id: 4, title: "Travel Vlog", cover: "/cover.jpg", videoUrl: "", duration: "08:20", author: "TEco Lab", level: "⭐⭐", difficulty: 2, category: "旅行", isLearned: false },
    { id: 5, title: "Tech News", cover: "/cover.jpg", videoUrl: "", duration: "12:45", author: "TEco Lab", level: "⭐⭐⭐⭐", difficulty: 4, category: "科技", isLearned: false },
    { id: 6, title: "Cooking Class", cover: "/cover.jpg", videoUrl: "", duration: "20:10", author: "TEco Lab", level: "⭐", difficulty: 1, category: "美食", isLearned: true },
];