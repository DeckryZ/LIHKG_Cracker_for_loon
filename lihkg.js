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
                    var isContentPost = !!contentPostIds[item.post_id];

                    if (isLevel1 || isStoryReply) {
                        // 1. 帖子正文内容不显示回复
                        if (isContentPost) {
                            return true;
                        }

                        var replies = replyMap[item.post_id];
                        if (replies && replies.length > 0) {
                            
                            // 2. 统一排序逻辑（无论一条还是多条，都走这套严格流程）
                            // 使用 parseInt 强制转数字，防止数据格式问题导致不显示
                            replies.sort(function(a, b) {
                                var likeA = parseInt(a.like_count) || 0;
                                var disA = parseInt(a.dislike_count) || 0;
                                var likeB = parseInt(b.like_count) || 0;
                                var disB = parseInt(b.dislike_count) || 0;

                                var scoreA = Math.abs(likeA - disA);
                                var scoreB = Math.abs(likeB - disB);

                                // 优先选绝对值大的（热度高）
                                if (scoreA !== scoreB) {
                                    return scoreB - scoreA; 
                                }
                                // 绝对值一样，选赞+踩总数多的
                                return (likeB + disB) - (likeA + disA);
                            });

                            // 取第一名
                            var bestReply = replies[0];

                            if (bestReply) {
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
