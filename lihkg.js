var body = JSON.parse($response.body);
var res = body.response;

if (res) {
    if (res.me) {
        res.me.is_plus_user = true;
        res.me.plus_expiry_time = new Date(9876, 4, 4, 3, 21, 0).getTime() / 1000;
    }

    var optimizePost = function(item) {
        item.display_vote = true;

        if (item.category && typeof item.like_count !== "undefined" && typeof item.dislike_count !== "undefined") {
            var total = item.like_count + item.dislike_count;
            var rate = 0;
            
            if (total > 0) {
                rate = Math.floor(Math.abs(item.like_count - item.dislike_count) / total * 100);
            }
            
            item.category.name = rate + "% ";
        }
    };

    if (res.items) {
        res.items.forEach(optimizePost);
    }

    if (res.category && typeof res.like_count !== "undefined") {
        optimizePost(res);
    }
    
    if (res.item_data) {
        if (Array.isArray(res.item_data)) {
            res.item_data.forEach(function(c) { c.display_vote = true; });
        } else {
            res.item_data.display_vote = true;
        }
    }
}

$done({ body: JSON.stringify(body) });
