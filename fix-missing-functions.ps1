# 修复 VideoDetail.jsx 中缺失的数据获取函数
$filePath = "src/pages/VideoDetail.jsx"
$content = Get-Content $filePath -Raw

# 找到并替换缺失fetchVideoData的useEffect
$oldPattern = @"
    // 初始化数据
    useEffect\(\(\) => \{
        fetchVideoData\(\);

        // 每次切换视频时，重新检查该视频的学习状态和收藏状态
        const learnedIds = JSON\.parse\(localStorage\.getItem\('learnedVideoIds'\) \|\| '\[\]'\);
        setIsLearned\(learnedIds\.includes\(parseInt\(id\)\)\);

        const favoriteIds = JSON\.parse\(localStorage\.getItem\('favoriteVideoIds'\) \|\| '\[\]'\);
        setIsFavorite\(favoriteIds\.includes\(parseInt\(id\)\)\);
    \}, \[id\]\);
"@

$newPattern = @"
    // 从 Supabase 获取当前视频数据
    useEffect(() => {
        const fetchVideoData = async () => {
            const { data, error } = await supabase
                .from('videos')
                .select('*')
                .eq('id', parseInt(id))
                .single();
            
            if (error) {
                console.error('Error fetching video:', error);
            } else {
                console.log('Video data loaded:', data);
                setVideoData(data);
            }
        };

        fetchVideoData();

        // 每次切换视频时，重新检查该视频的学习状态和收藏状态
        const learnedIds = JSON.parse(localStorage.getItem('learnedVideoIds') || '[]');
        setIsLearned(learnedIds.includes(parseInt(id)));

        const favoriteIds = JSON.parse(localStorage.getItem('favoriteVideoIds') || '[]');
        setIsFavorite(favoriteIds.includes(parseInt(id)));
    }, [id]);

    // 获取所有视频用于上一期/下一期导航
    useEffect(() => {
        const fetchAllVideos = async () => {
            const { data, error } = await supabase
                .from('videos')
                .select('id, episode')
                .order('episode', { ascending: false });
            
            if (error) {
                console.error('Error fetching all videos:', error);
            } else {
                setAllVideos(data || []);
            }
        };

        fetchAllVideos();
    }, []);
"@

$content = $content -replace $oldPattern, $newPattern

Set-Content -Path $filePath -Value $content -NoNewline
Write-Host "Successfully added fetchVideoData and fetchAllVideos functions"
