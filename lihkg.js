/*
 * LIHKG Pro (Gemini Edition)
 * ----------------------------
 * 1. Google Gemini 粤语深度翻译
 * 2. VIP 解锁 + 去广告
 * 3. 极速神评挂载 + 智能排序
 */

var body = JSON.parse($response.body);
var res = body.response;
var url = $request.url;

// ================= 参数解析区域 =================
// 读取插件传入的 argument (即 Gemini API Key)
var geminiApiKey = "";

if (typeof $argument !== "undefined" && $argument !== "") {
    // 处理可能包含的引号或空格
    geminiApiKey = $argument.replace(/"/g, "").trim();
}
// ===============================================

// 页面类型判断
var isThreadPage = url.indexOf("/page/") !== -1 && url.indexOf("quotes") === -1;
var isQuotePage = url.indexOf("quotes") !== -1;
var newsRegex = /[：｜「」]/;

// Gemini API 调用函数 (替换了原来的 DeepSeek)
function callGemini(text) {
    return new Promise(function(resolve, reject) {
        if (!text || text.trim() === "" || !geminiApiKey) {
            resolve(null);
            return;
        }

        // Gemini 接口地址 (使用 Flash 模型速度更快)
        var apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + geminiApiKey;
        
        // 提示词：强制指定粤语转简体中文，保持简洁
        var prompt = "你是一个精通粤语和普通话的翻译助手。请将以下香港粤语文本翻译成通顺的简体中文。直接输出翻译结果，不要包含任何解释、拼音或额外标点：\n" + text;
        
        // Gemini 的请求体结构
        var requestBody = {
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }]
        };

        var options = {
            url: apiUrl,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody),
            timeout: 5000 // 5秒超时
        };

        $httpClient.post(options, function(error, response, data) {
            if (error) {
                console.log("Gemini Network Error: " + error);
                resolve(null);
            } else {
                try {
                    var result = JSON.parse(data);
                    // Gemini 的响应解析路径
                    if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts) {
                        resolve(result.candidates[0].content.parts[0].text.trim());
                    } else {
                        console.log("Gemini No Candidates: " + data);
                        resolve(null);
                    }
                } catch (e) {
                    console.log("Gemini Parse Error: " + e);
                    resolve(null);
                }
            }
        });
    });
}

// 评论排序算法 (保持不变)
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

// 主逻辑处理 (破解、排序、挂载 - 保持不变)
function processMainLogic() {
    if (res) {
        // 1. VIP 解锁
        if (res.me) {
            res.me.is_plus_user = true;
            res.me.plus_expiry_time = 253402300799;
        }

        // 2. 列表页增强
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

        // 3. 帖子详情页增强
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
                                if (!replyContent || replyContent.trim() === "") {
                                    replyContent = "<em>[图片/贴纸]</em>";
                                }
                                
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

        // 4. 类别页显示点赞比
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

// 1. 执行本地逻辑
processMainLogic();

// 2. 异步处理：调用 Gemini 进行翻译
if (isThreadPage && geminiApiKey && res && res.title) {
    callGemini(res.title).then(function(translatedTitle) {
        if (translatedTitle) {
            // 翻译成功：换行追加结果
            res.title += "\n" + translatedTitle;
        }
        $done({ body: JSON.stringify(body) });
    }).catch(function() {
        $done({ body: JSON.stringify(body) });
    });
} else {
    $done({ body: JSON.stringify(body) });
}
