var body = JSON.parse($response.body);
var res = body.response;
var isThreadPage = $request.url.indexOf("/page/") !== -1 && $request.url.indexOf("quotes") === -1;

// 优化1：正则表达式提取到循环外，避免重复创建
var newsRegex = /[：｜「」]/;

if (res) {
    if (res.me) {
        res.me.is_plus_user = true;
        res.me.plus_expiry_time = new Date(9876, 4, 4, 3, 21, 0).getTime() / 1000;
    }

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
                    // 使用提取出的正则对象
                    if (newsRegex.test(item.title)) { prefix = "🆕 "; }
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

    if (res.item_data) {
        if (Array.isArray(res.item_data)) {
            if (isThreadPage) {
                var threadOwnerId = res.user ? res.user.user_id : -1;
                // 优化2：使用对象 (Hash Map) 代替数组，查询速度提升至 O(1)
                var contentPostIds = {}; 
                var replyMap = {}; 

                if (res.page === "1" || res.page === 1) {
                    for (var i = 0; i < res.item_data.length; i++) {
                        var item = res.item_data[i];
                        if (item.user.user_id === threadOwnerId) {
                            // 存入 Key-Value 结构
                            contentPostIds[item.post_id] = true;
                        } else {
                            break; 
                        }
                    }
                }

                // 构建回复关系图
                for (var i = 0; i < res.item_data.length; i++) {
                    var item = res.item_data[i];
                    if (item.quote_post_id) {
                        if (!replyMap[item.quote_post_id]) {
                            replyMap[item.quote_post_id] = [];
                        }
                        replyMap[item.quote_post_id].push(item);
                    }
                }

                res.item_data = res.item_data.filter(function(item) {
                    var isLevel1 = !item.quote_post_id;
                    // 使用 Hash 查询，无需 indexOf 遍历
                    var isStoryReply = !!contentPostIds[item.quote_post_id];
                    
                    if (isLevel1 || isStoryReply) {
                        var replies = replyMap[item.post_id];
                        if (replies && replies.length > 0) {
                            
                            // 优化3：移除 Sort 排序，改用单次遍历寻找最大值 (O(N))
                            // 寻找绝对值净分最高的评论
                            var bestReply = null;
                            var maxScore = -1;

                            for (var j = 0; j < replies.length; j++) {
                                var r = replies[j];
                                var currentScore = Math.abs(r.like_count - r.dislike_count);
                                
                                if (currentScore > maxScore) {
                                    maxScore = currentScore;
                                    bestReply = r;
                                }
                            }

                            if (bestReply) {
                                item.msg += "<br><br><blockquote><small><strong>" + bestReply.user_nickname + ":</strong><br>" + bestReply.msg + "</small></blockquote>";
                            }
                        }
                        return true;
                    }
                    return false;
                });
            }

            res.item_data.forEach(function(item) {
                item.display_vote = true;
            });

        } else {
            res.item_data.display_vote = true;
        }

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
