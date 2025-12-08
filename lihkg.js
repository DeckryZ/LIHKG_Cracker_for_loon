var body = JSON.parse($response.body);
var res = body.response;

// 判断页面类型
var url = $request.url;
// 主帖子页 (显示一级评论)
var isThreadPage = url.indexOf("/page/") !== -1 && url.indexOf("quotes") === -1;
// 二级评论详情页 (点进某条评论看回复)
var isQuotePage = url.indexOf("quotes") !== -1;

var newsRegex = /[：｜「」]/;

// 排序函数提取：供两处复用
function sortReplies(replies) {
    if (!replies || replies.length <= 1) return;
    replies.sort(function(a, b) {
        var likeA = +a.like_count || 0;
        var disA = +a.dislike_count || 0;
        var likeB = +b.like_count || 0;
        var disB = +b.dislike_count || 0;

        var absA = Math.abs(likeA - disA);
        var absB = Math.abs(likeB - disB);

        // 优先级1：绝对值（热度）
        if (absA !== absB) {
            return absB - absA; 
        }
        // 优先级2：总票数
        return (likeB + disB) - (likeA + disA);
    });
}

if (res) {
    if (res.me) {
        res.me.is_plus_user = true;
        res.me.plus_expiry_time = new Date(9876, 4, 4, 3, 21, 0).getTime() / 1000;
    }

    // 1. 列表标题增强
    if (res.items) {
        res.items.forEach(function(item) {
            item.display_vote = true;
            if (item.category && typeof item.like_count !== "undefined") {
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

    if (res.item_data && Array.isArray(res.item_data)) {
        
        // 2. 二级评论详情页 (Quotes Page) - 排序增强
        if (isQuotePage) {
            // 直接对整个列表进行热度排序
            sortReplies(res.item_data);
        }

        // 3. 帖子主页 (Thread Page) - 挂载神评增强
        if (isThreadPage) {
            var threadOwnerId = res.user ? res.user.user_id : -1;
            var contentPostIds = {}; 
            var replyMap = {}; 

            if (res.page === "1" || res.page === 1) {
                for (var i = 0; i < res.item_data.length; i++) {
                    var item = res.item_data[i];
                    if (item.user.user_id === threadOwnerId) {
                        contentPostIds[String(item.post_id)] = true;
                    } else { break; }
                }
            }

            for (var i = 0; i < res.item_data.length; i++) {
                var item = res.item_data[i];
                var qId = item.quote_post_id;
                if (qId && qId !== "0" && qId !== "") {
                    var qIdStr = String(qId);
                    if (!replyMap[qIdStr]) replyMap[qIdStr] = [];
                    replyMap[qIdStr].push(item);
                }
            }

            res.item_data = res.item_data.filter(function(item) {
                var currentIdStr = String(item.post_id);
                var isLevel1 = !item.quote_post_id || item.quote_post_id === "0" || item.quote_post_id === "";
                var isStoryReply = !!contentPostIds[String(item.quote_post_id)];
                var isContentPost = !!contentPostIds[currentIdStr];

                if (isLevel1 || isStoryReply) {
                    if (isContentPost) return true;

                    var replies = replyMap[currentIdStr];
                    if (replies && replies.length > 0) {
                        // 使用统一的排序函数
                        sortReplies(replies);
                        var bestReply = replies[0];

                        if (bestReply) {
                            var replyContent = bestReply.msg;
                            if (!replyContent || replyContent.trim() === "") {
                                replyContent = "<em>[图片/贴纸]</em>";
                            }
                            
                            var colorClass = "blue"; 
                            var isOwner = (bestReply.user.user_id === threadOwnerId);
                            
                            if (isOwner) {
                                colorClass = "yellow"; 
                            } else if (bestReply.user.gender === "F") {
                                colorClass = "red";
                            } else if (bestReply.user.gender === "M") {
                                colorClass = "blue";
                            }

                            item.msg += "<br><br><blockquote><span class=\"small " + colorClass + "\">" + bestReply.user_nickname + "</span>:<br>" + replyContent + "</blockquote>";
                        }
                    }
                    return true;
                }
                return false;
            });
        }

        // 统一处理：显示投票数
        res.item_data.forEach(function(item) {
            item.display_vote = true;
        });
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

$done({ body: JSON.stringify(body) });
