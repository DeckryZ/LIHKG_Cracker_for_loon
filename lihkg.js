

var body = JSON.parse($response.body);

if (body.response && body.response.me) {
    body.response.me.is_plus_user = true;
    body.response.me.plus_expiry_time = new Date(9876, 4, 4, 3, 21, 0).getTime() / 1000;
}


if (body.response && body.response.items) {
    body.response.items.forEach(function(item) {
        item.display_vote = true;
    });
}


if (body.response && body.response.item_data) {
    if (Array.isArray(body.response.item_data)) {
        body.response.item_data.forEach(function(item) {
            item.display_vote = true;
        });
    } else {
        body.response.item_data.display_vote = true;
    }
}


if (body.response && typeof body.response.display_vote !== "undefined") {
    body.response.display_vote = true;
}

$done({ body: JSON.stringify(body) });
