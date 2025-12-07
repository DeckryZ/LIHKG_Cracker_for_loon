var body = JSON.parse($response.body);
var res = body.response;

// --- 核心判断逻辑修正 ---
// isThreadPage = true 代表正在看“帖子主页”，需要执行过滤（只看一级回复）。
// 修正后：必须包含 "/page/" 且 绝对不能包含 "quotes" (引用详情)。
var isThreadPage = $request.url.indexOf("/page/") !== -1 && $request.url.indexOf("quotes") === -1;

if (res) {
    // ===================================
    // 1. 全局功能：VIP + 9876年彩蛋
    // ===================================
    if (res.me) {
        res.me.is_plus_user = true;
        res.me.plus_expiry_time = new Date(9876, 4, 4, 3, 21, 0).getTime() / 1000;
    }

    // ===================================
    // 2. 列表页处理 (满意率 + Emoji)
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
                    // 1. 热门 (is_hot)
                    if (item.is_hot) { prefix = "🔥 "; }
                    // 2. 新闻 (标题含标点)
                    if (/[：｜「」]/.test(item.title)) { prefix = "🆕 "; }
                    // 3. 争议/长贴 (最高优先级)
                    if (item.total_page > 3) { prefix = "⚔️ "; }
                    if (item.no_of_reply > 15 && rate < 30) { prefix = "⚔️ "; }

                    if (prefix !== "" && item.title && item.title.indexOf(prefix) !== 0) {
                        item.title = prefix + item.title;
                    }
                }
                item.category.name = rate + "% ";
            }
        });
    }

    // ===================================
    // 3. 详情页处理 (智能分流)
    // ===================================
    if (res.item_data) {
        if (Array.isArray(res.item_data)) {
            
            // --- 智能过滤逻辑 ---
            // 只有在“纯帖子主页” (isThreadPage) 时，才过滤楼中楼。
            // 如果 URL 里带有 "quotes" (如你截图所示)，这行代码为 false，就不会过滤。
            if (isThreadPage) {
                res.item_data = res.item_data.filter(function(item) {
                    // 只保留直接回复楼主的评论
                    return !item.quote_post_id;
                });
            }

            // 强制显赞 (无论过滤与否都要执行)
            res.item_data.forEach(function(item) {
                item.display_vote = true;
            });

        } else {
            // 单个对象情况
            res.item_data.display_vote = true;
        }

        // 详情页顶部标题满意率
        if (res.category && typeof res.like_count !== "undefined") {
             res.display_vote = true;
             var dTotal = res.like_count + res.dislike_count;
             if (dTotal > 0) {
                 var dRate = Math.floor(Math.abs(res.like_count - res.dislike_count) / dTotal * 100);
                 res.category.name = dRate + "% ";
             }
        }
    }
}

$done({ body: JSON.stringify(body) });
