
var body = JSON.parse($response.body);
var res = body.response; 

if (res) {

    if (res.me) {
        res.me.is_plus_user = true;
        res.me.plus_expiry_time = new Date(9876, 4, 4, 3, 21, 0).getTime() / 1000;
    }


    var openVote = function(item) { item.display_vote = true; };

    [res.items, res.item_data].forEach(function(list) {
        if (Array.isArray(list)) list.forEach(openVote);
    });

    if (res.item_data && !Array.isArray(res.item_data)) {
        openVote(res.item_data);
    }
    if (typeof res.display_vote !== "undefined") {
        openVote(res);
    }
}

$done({ body: JSON.stringify(body) });
