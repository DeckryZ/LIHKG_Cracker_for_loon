/*
 * LIHKG Pro (API Translation Edition)
 * 核心逻辑：极速筛选神评 + Google API 异步翻译
 * 学习自 DualSubs 架构
 */

const google_api = "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=zh-CN&q=";
// 随机 UA 池 (参考 DualSubs 防止被 Ban)
const ua_pool = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
    "GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)"
];

// 封装异步翻译函数 (Promise)
function translate(text) {
    return new Promise((resolve) => {
        if (!text || text.trim().length === 0) {
            resolve(text);
            return;
        }
        
        // 简单清理 HTML 标签防止翻译错乱 (简单的正则)
        // 真实环境最好不要动 HTML，但 Google 可能会把标签翻译坏，这里仅做简单处理
        // 为了稳定性，我们只翻译纯文本部分，或者稍微忍受一点标签损耗
        let cleanText = text.replace(/<[^>]+>/g, ""); 
        if(cleanText.trim() === "") { resolve(text); return; }

        let url = google_api + encodeURIComponent(cleanText);
        let ua = ua_pool[Math.floor(Math.random() * ua_pool.length)];

        $httpClient.get({
            url: url,
            headers: { 'User-Agent': ua },
            timeout: 3000 // 3秒超时，超时直接返回原文，不卡死
        }, (error, response, data) => {
            if (error || !data) {
                resolve(text); // 失败返回原文
            } else {
                try {
                    let result = JSON.parse(data);
                    // Google 返回格式: [[["翻译文", "原文", ...], ...]]
                    if (result && result[0]) {
                        let trans = result[0].map(item => item[0]).join("");
                        // 将翻译结果拼接到原文后面，或者直接替换
                        // 这里选择：翻译文 (原文) 的形式，或者直接替换
                        resolve(trans); 
                    } else {
                        resolve(text);
                    }
                } catch (e) {
                    resolve(text);
                }
            }
        });
    });
}

// 主逻辑入口
(async function() {
    try {
        var body = JSON.parse($response.body);
        var res = body.response;
        var isThreadPage = $request.url.indexOf("/page/") !== -1 && $request.url.indexOf("quotes") === -1;
        var newsRegex = /[：｜「」]/;

        // 收集所有的翻译任务
        let translationTasks = [];

        if (res) {
            if (res.me) {
                res.me.is_plus_user = true;
                res.me.plus_expiry_time = new Date(9876, 4, 4, 3, 21, 0).getTime() / 1000;
            }

            // === 列表页处理 ===
            if (res.items) {
                res.items.forEach(function(item) {
                    item.display_vote = true;
                    // 任务：翻译标题
                    if (item.title) {
                        translationTasks.push(translate(item.title).then(t => item.title = t));
                    }

                    // 评分逻辑保持不变
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

            // === 详情页处理 ===
            if (res.item_data) {
                if (Array.isArray(res.item_data)) {
                    if (isThreadPage) {
                        var threadOwnerId = res.user ? res.user.user_id : -1;
                        var contentPostIds = {}; 
                        var replyMap = {}; 

                        // 1. 识别楼主连载
                        if (res.page === "1" || res.page === 1) {
                            for (var i = 0; i < res.item_data.length; i++) {
                                var item = res.item_data[i];
                                if (item.user.user_id === threadOwnerId) {
                                    contentPostIds[item.post_id] = true;
                                    // 任务：翻译楼主正文
                                    if(item.msg) {
                                        // 楼主正文通常包含 HTML 图片，翻译可能破坏格式
                                        // 简单策略：仅当内容不含大量标签时尝试翻译，或者暂不翻译正文防止乱码
                                        // translationTasks.push(translate(item.msg).then(t => item.msg = t));
                                    }
                                } else {
                                    break; 
                                }
                            }
                        }

                        // 2. 建立索引
                        for (var i = 0; i < res.item_data.length; i++) {
                            var item = res.item_data[i];
                            if (item.quote_post_id) {
                                if (!replyMap[item.quote_post_id]) {
                                    replyMap[item.quote_post_id] = [];
                                }
                                replyMap[item.quote_post_id].push(item);
                            }
                        }

                        // 3. 过滤 + 筛选神评 + 添加翻译任务
                        var filteredData = [];
                        
                        // 为了支持异步处理，这里我们不能用 filter，改用 for 循环
                        for (let i = 0; i < res.item_data.length; i++) {
                            let item = res.item_data[i];
                            let isLevel1 = !item.quote_post_id;
                            let isStoryReply = !!contentPostIds[item.quote_post_id];
                            let isContentPost = !!contentPostIds[item.post_id];

                            if (isLevel1 || isStoryReply) {
                                if (!isContentPost) {
                                    // 任务：翻译一级评论
                                    if(item.msg) {
                                        translationTasks.push(translate(item.msg).then(t => item.msg = t));
                                    }

                                    var replies = replyMap[item.post_id];
                                    if (replies && replies.length > 0) {
                                        var bestReply = null;
                                        // 极速筛选算法 (0-26 > 0-0)
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
                                            // 创建一个闭包来处理神评的挂载和翻译
                                            // 这里的逻辑是：必须等 bestReply 翻译完，再拼接到 item.msg 后面
                                            let task = translate(bestReply.msg).then(transMsg => {
                                                item.msg += "<br><br><blockquote><strong><span class=\"small\">" + bestReply.user_nickname + "</span>:</strong><br>" + transMsg + "</blockquote>";
                                            });
                                            translationTasks.push(task);
                                        }
                                    }
                                }
                                filteredData.push(item);
                            }
                        }
                        // 替换数据源
                        res.item_data = filteredData;
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

        // ⚠️ 关键点：等待所有 API 请求完成
        // DualSubs 也是这样做的，利用 Promise.all 并发请求
        await Promise.all(translationTasks);

        $done({ body: JSON.stringify(body) });

    } catch (e) {
        console.log("LIHKG Script Error: " + e);
        $done({}); // 出错放行原数据
    }
})();
