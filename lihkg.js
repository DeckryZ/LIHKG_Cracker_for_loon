var body = JSON.parse($response.body);
var res = body.response;

// ================= 参数解析 =================
var geminiApiKey = "";
var targetLang = "zh-CN";
var enableTitleTranslate = false;

if (typeof $argument !== "undefined" && $argument !== "") {
    var args = {};
    $argument.split("&").forEach(function(item) {
        var parts = item.split("=");
        if (parts.length >= 2) {
            var key = parts.shift();
            var value = parts.join("=");
            args[key] = value;
        }
    });
    if (args.gemini_api_key) {
        geminiApiKey = args.gemini_api_key;
        enableTitleTranslate = true;
    }
    if (args.target_lang) {
        targetLang = args.target_lang;
    }
}
// ===========================================

var url = $request.url;
var isThreadPage = url.indexOf("/page/") !== -1 && url.indexOf("quotes") === -1;
var isQuotePage = url.indexOf("quotes") !== -1;
var newsRegex = /[：｜「」]/;

function callGemini(text) {
    return new Promise(function(resolve, reject) {
        if (!text || text.trim() === "" || !geminiApiKey) {
            resolve(null);
            return;
        }
        var apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + geminiApiKey;
        var prompt = "Translate the following text to " + targetLang + ", keep it concise and only output the result:\n" + text;
        var requestBody = { "contents": [{ "parts": [{ "text": prompt }] }] };
        var options = {
            url: apiUrl,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
        };
        $httpClient.post(options, function(error, response, data) {
            if (error) {
                resolve(null);
            } else {
                try {
                    var result = JSON.parse(data);
                    if (result.candidates && result.candidates.length > 0) {
                        resolve(result.candidates[0].content.parts[0].text.trim());
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            }
        });
    });
}

function sortReplies(replies) {
    if (!replies || replies.length <= 1) return;
    replies.sort(function(a, b) {
        var likeA = +a.like_count || 0;
        var disA = +a.dislike_count || 0;
        var likeB = +b.like_count || 0;
        var disB = +b.dislike_count || 0;
        var absA = Math.abs(likeA - disA);
        var absB = Math.abs(likeB - disB);
        if (absA !== absB) return absB - absA;
        return (likeB + disB) - (likeA + disA);
    });
}

function processMainLogic() {
    if (res) {
        if (res.me) {
            res.me.is_plus_user = true;
            res.me.plus_expiry_time = 253402300799;
        }

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
                        if (item.is_hot) prefix = "🔥 ";
                        if (newsRegex.test(item.title)) prefix = "🆕 ";
                        if (item.total_page > 3) prefix = "⚔️ ";
                        if (item.no_of_reply > 15 && rate < 30) prefix = "⚔️ ";
                        if (prefix !== "" && item.title && item.title.indexOf(prefix) !== 0) {
                            item.title = prefix + item.title;
                        }
                    }
                    item.category.name = rate + "% ";
                }
            });
        }

        if (res.item_data && Array.isArray(res.item_data)) {
            if (isQuotePage) {
                sortReplies(res.item_data);
            }
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
                            sortReplies(replies);
                            var bestReply = replies[0];
                            if (bestReply) {
                                var replyContent = bestReply.msg;
                                if (!replyContent || replyContent.trim() === "") replyContent = "<em>[图片/贴纸]</em>";
                                var colorClass = "blue";
                                if (bestReply.user.user_id === threadOwnerId) colorClass = "yellow";
                                else if (bestReply.user.gender === "F") colorClass = "red";
                                item.msg += "<br><br><blockquote><span class=\"small " + colorClass + "\">" + bestReply.user_nickname + "</span>:<br>" + replyContent + "</blockquote>";
                            }
                        }
                        return true;
                    }
                    return false;
                });
            }
            res.item_data.forEach(function(item) {
                item.display_vote = true;
                item.is_minimized_keywords = false;
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
}

processMainLogic();

if (isThreadPage && enableTitleTranslate && geminiApiKey && res && res.title) {
    callGemini(res.title).then(function(translatedTitle) {
        if (translatedTitle) {
            // 直接换行追加译文，不添加任何前缀
            res.title += "\n" + translatedTitle;
        }
        $done({ body: JSON.stringify(body) });
    }).catch(function() {
        $done({ body: JSON.stringify(body) });
    });
} else {
    $done({ body: JSON.stringify(body) });
}
