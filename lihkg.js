var body = JSON.parse($response.body);
var res = body.response;
var isThreadPage = $request.url.indexOf("/page/") !== -1 && $request.url.indexOf("quotes") === -1;

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
                // 用对象存储正文ID，查询更快
                var contentPostIds = {}; 
                var replyMap = {}; 

                // 1. 识别楼主连载层 (Story Mode)
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

                // 2. 构建回复地图 (在过滤前，把所有回复关系记下来)
                for (var i = 0; i < res.item_data.length; i++) {
                    var item = res.item_data[i];
                    if (item.quote_post_id) {
                        if (!replyMap[item.quote_post_id]) {
                            replyMap[item.quote_post_id] = [];
                        }
                        replyMap[item.quote_post_id].push(item);
                    }
                }

                // 3. 核心过滤 + 嫁接逻辑
                res.item_data = res.item_data.filter(function(item) {
                    // 判断是否是一级评论（或楼主正文）
                    var isLevel1 = !item.quote_post_id;
                    var isStoryReply = !!contentPostIds[item.quote_post_id];
                    
                    // 如果是要保留的一级评论
                    if (isLevel1 || isStoryReply) {
                        // 去地图里找它的儿子（二级评论）
                        var replies = replyMap[item.post_id];
                        if (replies && replies.length > 0) {
                            
                            // 寻找绝对值净分最高的评论 (赞踩之差的绝对值)
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

                            // 嫁接：把最好的那条二级评论接在屁股后面
                            if (bestReply) {
                                item.msg += "<br><br><blockquote><small><strong>" + bestReply.user_nickname + ":</strong><br>" + bestReply.msg + "</small></blockquote>";
                            }
                        }
                        // 保留这条一级评论
                        return true;
                    }
                    
                    // 其他普通的二级评论，直接过滤掉，不显示在列表中
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
