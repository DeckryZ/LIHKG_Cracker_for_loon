var body = JSON.parse($response.body);
var res = body.response;
var isThreadPage = $request.url.indexOf("/page/") !== -1 && $request.url.indexOf("quotes") === -1;

if (res) {
    if (res.me) {
        res.me.is_plus_user = true;
        res.me.plus_expiry_time = new Date(9876, 4, 4, 3, 21, 0).getTime() / 1000;
    }

    // 列表页处理
    if (res.items) {
        res.items.forEach(function(item) {
            item.display_vote = true;
            if (item.category && typeof item.like_count !== "undefined" && typeof item.dislike_count !== "undefined") {
                var total = item.like_count + item.dislike_count;
                var rate = 0;
                if (total > 0) {
                    rate = Math.floor(Math.abs(item.like_count - item.dislike_count) / total * 100);
                    var prefix = "";
                    if (item.is_hot) { prefix = "🔥 "; }
                    if (/[：｜「」]/.test(item.title)) { prefix = "🆕 "; }
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

    // 详情页处理
    if (res.item_data) {
        if (Array.isArray(res.item_data)) {
            if (isThreadPage) {
                var threadOwnerId = res.user ? res.user.user_id : -1;
                var contentPostIds = {}; 
                var replyMap = {}; 

                // 1. 识别楼主连载正文 (Story Mode)
                if (res.page === "1" || res.page === 1) {
                    for (var i = 0; i < res.item_data.length; i++) {
                        var item = res.item_data[i];
                        if (item.user.user_id === threadOwnerId) {
                            contentPostIds[item.post_id] = true;
                        } else {
                            break; // 一旦断开，后面的都不算正文
                        }
                    }
                }

                // 2. 建立回复索引 (Map)
                for (var i = 0; i < res.item_data.length; i++) {
                    var item = res.item_data[i];
                    if (item.quote_post_id) {
                        if (!replyMap[item.quote_post_id]) {
                            replyMap[item.quote_post_id] = [];
                        }
                        replyMap[item.quote_post_id].push(item);
                    }
                }

                // 3. 过滤并处理
                res.item_data = res.item_data.filter(function(item) {
                    var isLevel1 = !item.quote_post_id;
                    var isStoryReply = !!contentPostIds[item.quote_post_id]; // 回复了楼主正文
                    var isContentPost = !!contentPostIds[item.post_id]; // 自己就是楼主正文

                    // 只保留：一级评论 OR 回复了正文的评论
                    if (isLevel1 || isStoryReply) {
                        
                        // 规则1：楼主的正文内容本身，不需要在屁股后面挂回复
                        if (isContentPost) {
                            return true;
                        }

                        // 开始寻找最佳回复
                        var replies = replyMap[item.post_id];
                        if (replies && replies.length > 0) {
                            var bestReply = null;

                            // === 逻辑拆分：单条 vs 多条 ===
                            
                            if (replies.length === 1) {
                                // 【情况A：只有一条】直接显示，无需任何判断
                                bestReply = replies[0];
                            } else {
                                // 【情况B：多条】执行严格排序
                                replies.sort(function(a, b) {
                                    // 强制转为数字，防止 undefined 或 字符串 导致的排序错误
                                    var likeA = Number(a.like_count) || 0;
                                    var disA = Number(a.dislike_count) || 0;
                                    var likeB = Number(b.like_count) || 0;
                                    var disB = Number(b.dislike_count) || 0;

                                    var absA = Math.abs(likeA - disA);
                                    var absB = Math.abs(likeB - disB);

                                    // 第一优先级：绝对值（热度）大的排前面
                                    if (absA !== absB) {
                                        return absB - absA; 
                                    }
                                    
                                    // 第二优先级：绝对值一样（比如 5-5 和 2-2），总票数多的排前面
                                    var totalA = likeA + disA;
                                    var totalB = likeB + disB;
                                    return totalB - totalA;
                                });
                                // 取第一名
                                bestReply = replies[0];
                            }

                            // 只有当找到了 bestReply 时才修改内容
                            if (bestReply) {
                                item.msg += "<br><br><blockquote><strong><span class=\"small\">" + bestReply.user_nickname + "</span>:</strong><br>" + bestReply.msg + "</blockquote>";
                            }
                        }
                        return true;
                    }
                    
                    // 其他回复（二级闲聊）直接过滤掉
                    return false;
                });
            }

            // 详情页强制显赞
            res.item_data.forEach(function(item) {
                item.display_vote = true;
            });

        } else {
            res.item_data.display_vote = true;
        }

        // 标题栏显赞
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
