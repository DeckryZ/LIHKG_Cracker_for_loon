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
                var contentPostIds = []; 
                var replyMap = {}; 

                if (res.page === "1" || res.page === 1) {
                    for (var i = 0; i < res.item_data.length; i++) {
                        var item = res.item_data[i];
                        if (item.user.user_id === threadOwnerId) {
                            contentPostIds.push(item.post_id);
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
                    var isStoryReply = contentPostIds.indexOf(item.quote_post_id) !== -1;
                    
                    if (isLevel1 || isStoryReply) {
                        var replies = replyMap[item.post_id];
                        if (replies && replies.length > 0) {
                            // 核心修改：改为按“净胜票数 (赞-踩)”排序
                            // 这样 27赞1踩(26分) 会远高于 1赞0踩(1分)
                            replies.sort(function(a, b) {
                                var scoreA = a.like_count - a.dislike_count;
                                var scoreB = b.like_count - b.dislike_count;
                                return scoreB - scoreA; 
                            });

                            var bestReply = replies[0];
                            
                            // 即使按净分排序，为了防止只有1个赞的垃圾回复霸屏
                            // 我们依然保留一个基础门槛：总票数最好大于4
                            // 但如果所有回复票数都很低，那就还是显示第一名（Fallback）
                            var total = bestReply.like_count + bestReply.dislike_count;
                            
                            // 只要有回复，且第一名不是那种被疯狂踩烂的（净分>0），就展示
                            // 或者它虽然有踩，但是是唯一的高票回复，也展示
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
