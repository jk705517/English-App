const AVATAR_OPTIONS = [
    // Lorelei 风格（可爱插画）
    { id: 'avatar1', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=Lily' },
    { id: 'avatar2', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=Max' },
    { id: 'avatar3', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=Luna' },
    { id: 'avatar4', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=Leo' },
    // Fun-Emoji 风格（有趣表情）
    { id: 'avatar5', url: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=happy' },
    { id: 'avatar6', url: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=cool' },
    { id: 'avatar7', url: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=star' },
    { id: 'avatar8', url: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=sun' },
    // Adventurer 风格（冒险者卡通）
    { id: 'avatar9', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Anna' },
    { id: 'avatar10', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Jack' },
    { id: 'avatar11', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Mia' },
    { id: 'avatar12', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Tom' },
    // Thumbs 风格（简约可爱）
    { id: 'avatar13', url: 'https://api.dicebear.com/9.x/thumbs/svg?seed=blue' },
    { id: 'avatar14', url: 'https://api.dicebear.com/9.x/thumbs/svg?seed=pink' },
    { id: 'avatar15', url: 'https://api.dicebear.com/9.x/thumbs/svg?seed=green' },
    { id: 'avatar16', url: 'https://api.dicebear.com/9.x/thumbs/svg?seed=orange' },
];

// 根据 avatar id 获取 URL
export const getAvatarUrl = (avatarId) => {
    const avatar = AVATAR_OPTIONS.find(a => a.id === avatarId);
    return avatar ? avatar.url : AVATAR_OPTIONS[0].url;
};

export default AVATAR_OPTIONS;
