var body = JSON.parse($response.body);
var res = body.response;
var isThreadPage = $request.url.indexOf("/page/") !== -1 && $request.url.indexOf("quotes") === -1;

// 优化1：正则预编译，避免在循环中重复创建消耗 CPU
var newsRegex = /[：｜「」]/;

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
                // 优化2：使用一元加号(+)进行极速数字转换
                var like = +item.like_count || 0;
                var dis = +item.dislike_count || 0;
                var total = like + dis;
                var rate = 0;
                
                if (total > 0) {
                    rate = Math.floor(Math.abs(like - dis) / total * 100);
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

    // 详情页处理
    if (res.item_data) {
        if (Array.isArray(res.item_data)) {
            if (isThreadPage) {
                var threadOwnerId = res.user ? res.user.user_id : -1;
                var contentPostIds = {}; 
                var replyMap = {}; 

                // 1. 识别楼主连载正文
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

                // 2. 建立回复索引
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
                    var isStoryReply = !!contentPostIds[item.quote_post_id];
                    var isContentPost = !!contentPostIds[item.post_id];

                    if (isLevel1 || isStoryReply) {
                        if (isContentPost) {
                            return true;
                        }

                        var replies = replyMap[item.post_id];
                        if (replies && replies.length > 0) {
                            var bestReply = null;

                            // === 逻辑拆分：单条 vs 多条 ===
                            
                            if (replies.length === 1) {
                                // 【情况A：只有一条】直接使用，无需计算
                                bestReply = replies[0];
                            } else {
                                // 【情况B：多条】优化3：使用线性扫描代替 Sort 排序 (O(N) vs O(N log N))
                                // 这比 Sort 更省电，且逻辑完全一致
                                
                                // 先假设第一个是最好的
                                bestReply = replies[0];
                                var bestLike = +bestReply.like_count || 0;
                                var bestDis = +bestReply.dislike_count || 0;
                                var maxAbs = Math.abs(bestLike - bestDis);
                                var maxTotal = bestLike + bestDis;

                                // 遍历剩下的，看看有没有更好的
                                for (var k = 1; k < replies.length; k++) {
                                    var r = replies[k];
                                    var l = +r.like_count || 0;
                                    var d = +r.dislike_count || 0;
                                    var curAbs = Math.abs(l - d);
                                    var curTotal = l + d;

                                    // 挑战擂主逻辑：
                                    // 1. 绝对值更大？胜出。
                                    // 2. 绝对值一样，但总票数更多？胜出。
                                    if (curAbs > maxAbs || (curAbs === maxAbs && curTotal > maxTotal)) {
                                        maxAbs = curAbs;
                                        maxTotal = curTotal;
                                        bestReply = r;
                                    }
                                }
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
