var body = JSON.parse($response.body);
var res = body.response;
var isThreadPage = $request.url.indexOf("/page/") !== -1 && $request.url.indexOf("quotes") === -1;

// 优化1：正则表达式提取到循环外
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
                // 优化2：Hash Map 查询
                var contentPostIds = {}; 
                var replyMap = {}; 

                if (res.page === "1" || res.page === 1) {
                    for (var i = 0; i < res.item_data.length; i++) {
                        var item = res.item_data[i];
                        if (item.user.user_id === threadOwnerId) {
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
                    var isStoryReply = !!contentPostIds[item.quote_post_id];
                    
                    if (isLevel1 || isStoryReply) {
                        var replies = replyMap[item.post_id];
                        if (replies && replies.length > 0) {
                            
                            // BUG修复核心：严格排序
                            // 1. 按绝对值（热度）从大到小排
                            // 2. 如果热度相同，按赞数从大到小排（防止负分和0分乱序）
                            replies.sort(function(a, b) {
                                var scoreA = Math.abs(a.like_count - a.dislike_count);
                                var scoreB = Math.abs(b.like_count - b.dislike_count);
                                if (scoreA === scoreB) {
                                    return b.like_count - a.like_count;
                                }
                                return scoreB - scoreA; 
                            });

                            var bestReply = replies[0];
                            var totalVotes = bestReply.like_count + bestReply.dislike_count;

                            // BUG修复核心2：单条回复的显示逻辑
                            // 只有一条回复时，必须有票（赞或踩）才显示
                            // 如果有多条回复，因为已经排序过，第一名肯定是最有资格的，直接显示
                            var shouldShow = true;
                            if (replies.length === 1) {
                                if (totalVotes === 0) {
                                    shouldShow = false;
                                }
                            }

                            if (shouldShow && bestReply) {
                                item.msg += "<br><br><blockquote><strong><span class=\"small\">" + bestReply.user_nickname + "</span>:</strong><br>" + bestReply.msg + "</blockquote>";
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
