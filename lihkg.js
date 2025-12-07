var body = JSON.parse($response.body);
var res = body.response;

if (res) {
    // ===================================
    // 1. 全局功能：VIP + 9876年彩蛋
    // ===================================
    if (res.me) {
        res.me.is_plus_user = true;
        res.me.plus_expiry_time = new Date(9876, 4, 4, 3, 21, 0).getTime() / 1000;
    }

    // ===================================
    // 2. 场景 A：帖子列表模式 (items 存在)
    //    功能：计算满意率、添加 🔥⚔️🆕 Emoji
    // ===================================
    if (res.items) {
        res.items.forEach(function(item) {
            item.display_vote = true;

            if (item.category && typeof item.like_count !== "undefined" && typeof item.dislike_count !== "undefined") {
                var total = item.like_count + item.dislike_count;
                var rate = 0;
                
                if (total > 0) {
                    rate = Math.floor(Math.abs(item.like_count - item.dislike_count) / total * 100);

                    var prefix = "";

                    // Emoji 优先级：⚔️ > 🆕 > 🔥
                    
                    // 1. 热门 (is_hot)
                    if (item.is_hot) {
                        prefix = "🔥 ";
                    }

                    // 2. 新闻 (标题含标点)
                    if (/[：｜「」]/.test(item.title)) {
                        prefix = "🆕 ";
                    }

                    // 3. 争议/长贴 (最高优先级)
                    if (item.total_page > 3) {
                        prefix = "⚔️ ";
                    }
                    if (item.no_of_reply > 15 && rate < 30) {
                        prefix = "⚔️ ";
                    }

                    // 应用标题前缀
                    if (prefix !== "" && item.title && item.title.indexOf(prefix) !== 0) {
                        item.title = prefix + item.title;
                    }
                }
                
                // 修改台名为满意率
                item.category.name = rate + "% ";
            }
        });
    }

    // ===================================
    // 3. 场景 B：帖子详情模式 (item_data 存在)
    //    功能：只显示“一级回复” (直接回楼主的)，过滤掉所有楼中楼
    // ===================================
    if (res.item_data) {
        // 如果是数组 (即帖子评论页)
        if (Array.isArray(res.item_data)) {
            // 🔥 核心过滤逻辑 🔥
            // 只保留 quote_post_id 为空 (直接回复) 的评论
            // 或者是帖子正文本身 (msg_num: 1)
            res.item_data = res.item_data.filter(function(item) {
                // 如果 quote_post_id 是空字符串 ""，说明是直接回复楼主
                // 如果是 undefined 或 null，通常是第一楼正文
                return !item.quote_post_id;
            });

            // 强制显赞
            res.item_data.forEach(function(item) {
                item.display_vote = true;
            });
        } 
        // 如果是对象 (极少数情况)
        else {
            res.item_data.display_vote = true;
        }
        
        // 处理顶部的分类信息 (如果有)
        if (res.category && typeof res.like_count !== "undefined") {
             res.display_vote = true;
             // 详情页标题也可以顺便算一下满意率
             var dTotal = res.like_count + res.dislike_count;
             if (dTotal > 0) {
                 var dRate = Math.floor(Math.abs(res.like_count - res.dislike_count) / dTotal * 100);
                 res.category.name = dRate + "% ";
             }
        }
    }
}

$done({ body: JSON.stringify(body) });
