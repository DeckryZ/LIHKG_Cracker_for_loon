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
                            replies.sort(function(a, b) {
                                var rateA = 0, rateB = 0;
                                var totalA = a.like_count + a.dislike_count;
                                var totalB = b.like_count + b.dislike_count;
                                
                                if (totalA > 0) rateA = Math.abs(a.like_count - a.dislike_count) / totalA;
                                if (totalB > 0) rateB = Math.abs(b.like_count - b.dislike_count) / totalB;
                                
                                return rateB - rateA; 
                            });

                            var bestReply = null;
                            var candidate1 = replies[0];
                            var total1 = candidate1.like_count + candidate1.dislike_count;
                            
                            if (total1 > 4) {
                                bestReply = candidate1;
                            } else if (replies.length > 1) {
                                var candidate2 = replies[1];
                                var total2 = candidate2.like_count + candidate2.dislike_count;
                                if (total2 > 4) {
                                    bestReply = candidate2;
                                }
                            }

                            if (!bestReply) {
                                var maxTotal = -1;
                                for (var k = 0; k < replies.length; k++) {
                                    var r = replies[k];
                                    var t = r.like_count + r.dislike_count;
                                    if (t > maxTotal) {
                                        maxTotal = t;
                                        bestReply = r;
                                    }
                                }
                            }

                            if (bestReply) {
                                // 去掉了投票数显示，只保留名字和内容
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
