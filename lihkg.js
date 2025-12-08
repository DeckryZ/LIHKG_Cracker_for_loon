var body = JSON.parse($response.body);
var res = body.response;
var isThreadPage = $request.url.indexOf("/page/") !== -1 && $request.url.indexOf("quotes") === -1;

// 优化1：正则预编译
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
                            contentPostIds[String(item.post_id)] = true;
                        } else {
                            break; 
                        }
                    }
                }

                // 2. 建立回复索引
                for (var i = 0; i < res.item_data.length; i++) {
                    var item = res.item_data[i];
                    var qId = item.quote_post_id;
                    if (qId && qId !== "0" && qId !== "") {
                        var qIdStr = String(qId);
                        if (!replyMap[qIdStr]) {
                            replyMap[qIdStr] = [];
                        }
                        replyMap[qIdStr].push(item);
                    }
                }

                // 3. 过滤并处理
                res.item_data = res.item_data.filter(function(item) {
                    var currentIdStr = String(item.post_id);
                    var isLevel1 = !item.quote_post_id || item.quote_post_id === "0" || item.quote_post_id === "";
                    var isStoryReply = !!contentPostIds[String(item.quote_post_id)];
                    var isContentPost = !!contentPostIds[currentIdStr];

                    if (isLevel1 || isStoryReply) {
                        if (isContentPost) {
                            return true;
                        }

                        var replies = replyMap[currentIdStr];
                        if (replies && replies.length > 0) {
                            var bestReply = null;

                            // === 极速筛选逻辑 ===
                            if (replies.length === 1) {
                                bestReply = replies[0];
                            } else {
                                bestReply = replies[0];
                                var bestLike = +bestReply.like_count || 0;
                                var bestDis = +bestReply.dislike_count || 0;
                                var maxAbs = Math.abs(bestLike - bestDis);
                                var maxTotal = bestLike + bestDis;

                                for (var k = 1; k < replies.length; k++) {
                                    var r = replies[k];
                                    var l = +r.like_count || 0;
                                    var d = +r.dislike_count || 0;
                                    var curAbs = Math.abs(l - d);
                                    var curTotal = l + d;

                                    if (curAbs > maxAbs || (curAbs === maxAbs && curTotal > maxTotal)) {
                                        maxAbs = curAbs;
                                        maxTotal = curTotal;
                                        bestReply = r;
                                        bestLike = l;
                                        bestDis = d;
                                    }
                                }
                            }

                            if (bestReply) {
                                var replyContent = bestReply.msg;
                                if (!replyContent || replyContent.trim() === "") {
                                    replyContent = "<em>[图片/贴纸]</em>";
                                }
                                
                                // === 颜色 Class 标记逻辑 ===
                                var colorClass = "blue"; // 默认为男性蓝色
                                var isOwner = (bestReply.user.user_id === threadOwnerId);
                                
                                if (isOwner) {
                                    colorClass = "yellow"; // 楼主：金色
                                } else if (bestReply.user.gender === "F") {
                                    colorClass = "red";    // 女性：红色
                                } else if (bestReply.user.gender === "M") {
                                    colorClass = "blue";   // 男性：蓝色
                                }

                                // 拼装 HTML：注意这里用了 class="small yellow" 这种写法
                                item.msg += "<br><br><blockquote><strong><span class=\"small " + colorClass + "\">" + bestReply.user_nickname + "</span>:</strong><br>" + replyContent + "</blockquote>";
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
