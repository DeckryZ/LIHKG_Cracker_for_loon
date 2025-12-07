var body = JSON.parse($response.body);
var res = body.response;
var isThreadPage = $request.url.indexOf("/page/") !== -1 && $request.url.indexOf("quotes") === -1;

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
                        if (isContentPost) {
                            return true;
                        }

                        var replies = replyMap[item.post_id];
                        if (replies && replies.length > 0) {
                            var bestReply = null;

                            // 逻辑彻底拆分
                            if (replies.length === 1) {
                                // 情况1：只有一条，无条件显示
                                bestReply = replies[0];
                            } else {
                                // 情况2：多条，严格排序
                                replies.sort(function(a, b) {
                                    var likeA = parseInt(a.like_count) || 0;
                                    var disA = parseInt(a.dislike_count) || 0;
                                    var likeB = parseInt(b.like_count) || 0;
                                    var disB = parseInt(b.dislike_count) || 0;

                                    var absA = Math.abs(likeA - disA);
                                    var absB = Math.abs(likeB - disB);

                                    // 绝对值大的排前面 (解决 0-26 没显示的问题)
                                    if (absA !== absB) {
                                        return absB - absA;
                                    }
                                    // 绝对值一样，总互动数多的排前面
                                    return (likeB + disB) - (likeA + disA);
                                });
                                bestReply = replies[0];
                            }

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
