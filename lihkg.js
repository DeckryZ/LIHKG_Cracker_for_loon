/*
* 脚本名称：LIHKG 终极破解 (VIP + 显赞 + 登录数修改)
* 更新时间：2025-12-06
*/

var body = JSON.parse($response.body);

// ---------------------------------------
// 1. 身份伪装 (VIP + 活跃度修改)
// ---------------------------------------
if (body.response && body.response.me) {
    // 开启白金会员
    body.response.me.is_plus_user = true;
    
    // 彩蛋日期：8765年4月3日 2:10:00
    body.response.me.plus_expiry_time = new Date(8765, 3, 3, 2, 10, 0).getTime() / 1000;
    
    // 🔥 修改登录次数为 365
    if (body.response.me.meta_data) {
        body.response.me.meta_data.login_count = 365;
    }

    // (可选) 去除新手限制
    // body.response.me.is_newbie = false;
    // body.response.me.level = 10;
}

// ---------------------------------------
// 2. 列表页透视 (items)
// ---------------------------------------
if (body.response && body.response.items) {
    body.response.items.forEach(function(item) {
        item.display_vote = true;
    });
}

// ---------------------------------------
// 3. 评论区透视 (item_data)
// ---------------------------------------
if (body.response && body.response.item_data) {
    if (Array.isArray(body.response.item_data)) {
        body.response.item_data.forEach(function(item) {
            item.display_vote = true;
        });
    } else {
        body.response.item_data.display_vote = true;
    }
}

// ---------------------------------------
// 4. 补漏：处理状态更新包
// ---------------------------------------
if (body.response && typeof body.response.display_vote !== "undefined") {
    body.response.display_vote = true;
}

$done({ body: JSON.stringify(body) });
