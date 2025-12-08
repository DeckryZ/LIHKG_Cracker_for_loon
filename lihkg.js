/*
 * LIHKG Pro (DeepSeek Engine)
 * ------------------------------
 * 功能：去广告 + 解锁VIP + 极速神评挂载 + DeepSeek 深度粤语翻译
 * 作者：Gemini & User
 */

// === DeepSeek 配置 ===
const DEEPSEEK_KEY = typeof $argument !== "undefined" ? $argument.trim() : "";
const DEEPSEEK_API = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";

// 系统提示词：专门针对连登粤语口语优化
const SYSTEM_PROMPT = "你是一个精通香港粤语俚语的翻译助手。请将用户提供的粤语文本翻译为通顺、地道的简体中文。遇到'收皮'、'抽水'、'二五仔'等俚语请意译。直接输出翻译结果，不要解释，不要包含原文。";

// 翻译函数 (封装 DeepSeek API)
function translate(text) {
    return new Promise((resolve) => {
        // 1. 基础检查
        if (!text || !text.trim()) { resolve(text); return; }
        
        // 2. 预处理：DeepSeek 对 HTML 标签的兼容性不错，但为了省 Token 和防错乱，
        //    我们把 <br> 换成换行符，翻译完再换回来。
        let content = text.replace(/<br\s*\/?>/gi, "\n");
        
        // 简单过滤纯表情或极短文本，省钱
        if (content.length < 2 && /[\uD800-\uDFFF]/.test(content)) { resolve(text); return; }

        // 3. 发起请求
        $httpClient.post({
            url: DEEPSEEK_API,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${DEEPSEEK_KEY}`
            },
            body: JSON.stringify({
                model: DEEPSEEK_MODEL,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: content }
                ],
                temperature: 1.1, // 稍微灵活一点以处理俚语
                max_tokens: 500,  // 限制回复长度
                stream: false
            }),
            timeout: 5000 // 5秒超时设定，防止连登卡死
        }, (error, response, data) => {
            if (error || !data) {
                console.log(`[DeepSeek Error] ${error}`);
                resolve(text); // 失败返回原文，保证能看
            } else {
                try {
                    let json = JSON.parse(data);
                    if (json.choices && json.choices.length > 0) {
                        let result = json.choices[0].message.content.trim();
                        // 还原换行符
                        result = result.replace(/\n/g, "<br>");
                        resolve(result);
                    } else {
                        console.log("[DeepSeek]
