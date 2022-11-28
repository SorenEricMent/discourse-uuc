import { default as https } from 'https';

//Edit it to your own configuation. Or feed winslow with lasagna.
const config = {
    "user_agent": "Discourse-uuc/1.1 By/WinslowSEM",
    "account_list": [
        {
            "username": "winslow",
            "password": "WhereIsMyLasagna?"
        }
    ],
    "host": "https://some.sus.discourse.forum",
    "category": "/c/anonymous/58",
    "time_range": {
        "start": "1989-06-05",
        "end": "9999-12-31"
    },
    "interval": {
        "login": 3000,
        "post_list_fetch": 2000,
        "post_fetch": 2000,
        "limit": {
            "post_list_fetch": 2000,
            "post_fetch": 2000,
            "post_stream_fetch": 1000
        } //This script will reduce the interval to accelerate the fetching process if multiple accounts are provided. This field could limit such optimization.
    },
    "fetch_window": 120
};



async function wrapper() {
    console.log("Discourse-uuc by Winslow SorenEricMent");
    console.log("A script that stat users under a certain category");
    var account_list = await loginAccounts(config.account_list);
    console.log(`${account_list.success.length} accounts logged in, ${account_list.failure.length} accounts failed.`);
    if(account_list.failure.length > 0){
        console.log("Fail list:");
        console.log(account_list.failure);
    }
    var post_list = await getPostList(account_list.success, config.host + config.category);
    if(post_list.length === 0){
        console.log("No post found.");
        return;
    }
    var post_detail = await fetchPostStream(post_list, account_list.success);
    let taskList = [];
    for(const key in post_detail){
        taskList.push({
            "post": key,
            "post_list": post_detail[key]
        });
    }
    let result = {};
    for(var i=0; i<taskList.length; i++){
        let task = taskList[i];
        let currentRes = await userInPostFetch(task.post, task.post_list, account_list.success);
        mergeJSON(result, currentRes);
    }
    console.log(result);
}



const gHeader = {
    "headers": {
        "accept": "*/*",
        "discourse-present": "true",
        "discourse-track-view": "true",
        "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"102\"",
        "user-agent": config.user_agent,
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Linux\"",
        "x-requested-with": "XMLHttpRequest"
    }
};

function cookieParser(raw) {
    var cookies = {
        "complex": {},
        "flag": [],
    };
    let parser = function (str) {
        let keyArray = str.split(";");
        for (const element of keyArray) {
            if (element.indexOf("=") === -1) {
                cookies.flag.push(element);
            } else {
                let keyValue = element.split("=");
                cookies.complex[keyValue[0]] = keyValue[1];
            }
        }
    }
    if (isArray(raw)) {
        for (const element of raw) {
            parser(element);
        }
    } else {
        parser(raw);
    }
    return cookies;
}

function isArray(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
}

function cookieRestore(obj) {
    let cookie = "";
    for (const key in obj.complex) {
        cookie += key + "=" + obj.complex[key] + ";";
    }
    return cookie;
}

function cookieExtract(raw) {
    let cookie = {
        "_t": "",
        "_forum_session": ""
    };
    for (const element of raw) {
        if (element.substring(0, 3) === "_t=") {
            cookie._t = cookieParser(element).complex["_t"];
        } else if (element.substring(0, 4) === "_for") {
            cookie._forum_session = cookieParser(element).complex["_forum_session"];
        }
    }
    return `_t=${cookie._t}; _forum_session=${cookie._forum_session}`;
}

function mergeJSON(origin, override) {
    for (const key in override) {
        if (typeof override[key] === "object") {
            if (isArray(override[key])) {
                origin[key] = override[key];
            } else {
                mergeJSON(origin[key], override[key]);
            }
        } else {
            origin[key] = override[key];
        }
    }
    return origin;
}

function loginAccounts(credentials) {
    let getCSRF = function () {
        return new Promise((resolve, reject) => {
            let requestData = {
                "headers": {
                    "X-CSRF-Token": "undefined"
                },
                "referrer": config.host + "/session/csrf",
                "method": "GET",
                "mode": "cors",
                "credentials": "omit"
            };
            requestData = mergeJSON(requestData, gHeader);
            invokeGet(config.host + "/session/csrf", requestData).then((data) => {
                data.body = JSON.parse(data.body);
                if (data.body.hasOwnProperty("csrf")) {
                    resolve([data.body.csrf, cookieParser(data.res.headers["set-cookie"])]);
                } else {
                    reject("Failed to request CSRF Token, login failed.");
                }
            });
        });
    }

    let session = function (csrf, username, password, cookie) {
        return new Promise((resolve, reject) => {
            let requestData = {
                "headers": {
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "x-csrf-token": csrf,
                    "cookie": cookie,
                    "Referer": config.host + "/login",
                },
                "method": "POST"
            };
            requestData = mergeJSON(requestData, gHeader);
            let body = "login=" + username + "&password=" + password + "&second_factor_method=1&timezone=Asia%2FShanghai";
            invokeReq(config.host + "/session", body, requestData).then(res => {
                resolve(cookieExtract(res.res.rawHeaders));
            });
        });
    }

    let login = function (username, password) {
        return new Promise((resolve, reject) => {
            getCSRF(config.host).then((answer) => {
                let cookie = cookieRestore(answer[1]);
                let un = encodeURIComponent(username);
                let p = encodeURIComponent(password);
                session(answer[0], un, p, cookie).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            });
        });
    }

    return new Promise((resolve, reject) => {
        let offset = 0;
        let promises = [];
        for (const element of credentials) {
            promises.push(login(element.username, element.password));
        }
        Promise.allSettled(promises).then((results) => {
            let users = {
                "success": [],
                "failure": []
            };
            for (const element of results) {
                if (element.status === "fulfilled") {
                    users.success.push(element.value);
                } else {
                    users.failure.push(element.reason);
                }
            }
            resolve(users);
        }
        ).catch((err) => {
            console.log(err);
            reject(err);
        }
        );
    });
}

function getPostList(account_list, url) {
    return new Promise((resolve, reject) => {
        let accountIndex = 0;
        let pageCounter = 0;
        let postIDList =  [];
        let listLength = account_list.length;
        let startTimestamp = toTimestamp(config.time_range.start);
        let endTimestamp = toTimestamp(config.time_range.end);
        var fetchPostLoop = setInterval(async () => {
            let currentAccount = account_list[accountIndex];
            accountIndex++;
            if (accountIndex >= listLength) {
                accountIndex = 0;
            }
            let currentUrl = url + ".json?page=" + pageCounter;
            let requestData = {
                "headers": {
                    "cookie": currentAccount
                },
                "referrer": currentUrl,
                "method": "GET",
            };
            requestData = mergeJSON(requestData, gHeader);
            await invokeGet(currentUrl, requestData).then((data) => {
                if (data.res.headers.hasOwnProperty("set-cookie")) {
                    let cookies = data.res.headers["set-cookie"];
                    let legacyCookies = cookieParser(currentAccount);
                    if(cookies.length > 1){
                        legacyCookies._forum_session = cookies[1];
                        legacyCookies._t = cookies[0];
                    }else{
                        legacyCookies._forum_session = cookies[0];
                    }
                    currentAccount = cookieRestore(legacyCookies);
                    account_list[accountIndex] = currentAccount;
                }
                data.body = JSON.parse(data.body);
                if (data.body.hasOwnProperty("topic_list")) {
                    console.log("Fetching page " + pageCounter);
                    let topic_list = data.body.topic_list.topics;
                    for (const topic of topic_list) {
                        if (topic.hasOwnProperty("id")) {
                            if(topic.pinned){
                                continue;
                            }
                            topic.last_posted_at = toTimestamp(topic.last_posted_at);
                            if(topic.last_posted_at < endTimestamp){
                                if(topic.last_posted_at < startTimestamp){
                                    console.log("Fetched topic with update timestamp less than dictated start timestamp, halting topics fetch loop.");
                                    clearInterval(fetchPostLoop);
                                    resolve(postIDList);
                                    break;
                                }else{
                                    console.log(" - Added topic with id: " + topic.id + " to topic list with update timestamp: " + topic.last_posted_at + ".");
                                    postIDList.push(topic.id);
                                }
                            }
                        }
                    }
                }else{
                    console.log("Failed to fetch topic list, halting topics fetch loop.");
                    clearInterval(fetchPostLoop);
                    resolve(postIDList);
                }
                pageCounter++;
            });
        }, config.interval.post_list_fetch / listLength > config.interval.limit.post_list_fetch ? config.interval.post_list_fetch / listLength : config.interval.limit.post_list_fetch);
    
    })
}

function fetchPostStream(id_list, account_list){
    console.log(id_list);
    let accountIndex = 0;
    let postIndex = 0;
    let listLength = account_list.length;
    let postStreamList = {};
    let url = config.host + "/t/";
    return new Promise((resolve, reject) => {
        let fetchPostStreamInterval = setInterval(async () => {
            let currentAccount = account_list[accountIndex];
            accountIndex++;
            if (accountIndex >= listLength) {
                accountIndex = 0;
            }
            let currentUrl = url + id_list[postIndex] + ".json";
            console.log("Fetching post stream from " + currentUrl);
            let requestData = {
                "headers": {
                    "cookie": currentAccount
                },
                "referrer": currentUrl,
                "method": "GET",
            };
            requestData = mergeJSON(requestData, gHeader);
            await invokeGet(currentUrl, requestData).then((data) => {
                if (data.res.headers.hasOwnProperty("set-cookie")) {
                    let cookies = data.res.headers["set-cookie"];
                    let legacyCookies = cookieParser(currentAccount);
                    if(cookies.length > 1){
                        legacyCookies._forum_session = cookies[1];
                        legacyCookies._t = cookies[0];
                    }else{
                        legacyCookies._forum_session = cookies[0];
                    }
                    currentAccount = cookieRestore(legacyCookies);
                    account_list[accountIndex] = currentAccount;
                }
                data.body = JSON.parse(data.body);
                postStreamList[id_list[postIndex]] = [];
                if (data.body.hasOwnProperty("post_stream")) {
                    let post_stream = data.body.post_stream.stream;
                    for (const postID of post_stream) {
                        postStreamList[id_list[postIndex]].push(postID);
                        console.log(" - Added post with id: " + postID + " to post stream list " + id_list[postIndex] + ".");
                    }
                }else{
                    console.log("Failed to fetch post list, halting posts fetch loop.");
                    clearInterval(fetchPostStreamInterval);
                    reject();
                }
                postIndex++;
                if(postIndex >= id_list.length){
                    clearInterval(fetchPostStreamInterval);
                    resolve(postStreamList);
                }
            });
        }, config.interval.post_stream_fetch / listLength > config.interval.limit.post_stream_fetch ? config.interval.post_stream_fetch / listLength : config.interval.limit.post_stream_fetch);
    })
}
function userInPostFetch(post_id, post_list , account_list){
    let userSet = {};
    let accountIndex = 0;
    let startTimestamp = toTimestamp(config.time_range.start);
    let endTimestamp = toTimestamp(config.time_range.end);
    let listLength = account_list.length;
    let url = config.host + "/t/" + post_id + "/posts.json?&";
    return new Promise((resolve, reject) => {
        let fetchPostInterval = setInterval(async () => {
            let currentAccount = account_list[accountIndex];
            let currentUrl = url;
            accountIndex++;
            if (accountIndex >= listLength) {
                accountIndex = 0;
            }
            let limitCounter = 0;
            while(true){
                if(post_list.length == 0){
                    break;
                }
                currentUrl += "post_ids[]=" + post_list.pop() + "&";
                limitCounter++;
                if(limitCounter >= config.fetch_window){
                    console.log("Breaking for window.");
                    break;   
                }
            }
            console.log("Fetching posts from " + currentUrl);
            let requestData = {
                "headers": {
                    "cookie": currentAccount
                },
                "referrer": currentUrl,
                "method": "GET",
            };
            requestData = mergeJSON(requestData, gHeader);
            await invokeGet(currentUrl, requestData).then((data) => {
                console.log(" --- " + post_list);
                if (data.res.headers.hasOwnProperty("set-cookie")) {
                    let cookies = data.res.headers["set-cookie"];
                    let legacyCookies = cookieParser(currentAccount);
                    if(cookies.length > 1){
                        legacyCookies._forum_session = cookies[1];
                        legacyCookies._t = cookies[0];
                    }else{
                        legacyCookies._forum_session = cookies[0];
                    }
                    currentAccount = cookieRestore(legacyCookies);
                    account_list[accountIndex] = currentAccount;
                }
                data.body = JSON.parse(data.body);
                if (data.body.hasOwnProperty("post_stream")) {
                    let post_stream = data.body.post_stream.posts.reverse();
                    for (const post of post_stream) {
                        if (post.hasOwnProperty("id")) {
                            post.created_at = toTimestamp(post.created_at);
                            if(post.created_at < endTimestamp){
                                if(post.created_at < startTimestamp){
                                    console.log("Fetched post with update timestamp less than dictated start timestamp, halting posts fetch loop.");
                                    clearInterval(fetchPostInterval);
                                    resolve(userSet);
                                    break;
                                }else{
                                    console.log(" - Readed user from post with id: " + post.id + " with update timestamp: " + post.created_at + ".");
                                    userSet[post.user_id] = post.username;
                                }
                            }
                        }
                    }
                }else{
                    console.log("Failed to fetch post list, halting posts fetch loop.");
                    clearInterval(fetchPostInterval);
                    reject();
                }
                if(post_list.length <= 0){
                    clearInterval(fetchPostInterval);
                    resolve(userSet);
                }
            });
        }, config.interval.post_fetch / listLength > config.interval.limit.post_fetch ? config.interval.post_fetch / account_list.length : config.interval.limit.post_fetch);
    });
}

function invokeGet(host, data) {
    return new Promise((resolve, reject) => {
        let resp = Buffer.alloc(0);
        https.get(host, data, res => {
            res.on('data', function (chunk) {
                resp = Buffer.concat([resp, chunk]);
            });
            res.on('end', () => {
                resp = resp.toString();
                resolve({
                    "res": res,
                    "body": resp
                });
            });
        }).on('error', err => {
            reject(err);
        });
    });
}

function invokeReq(host, body, options) {
    return new Promise((resolve, reject) => {
        let newRequest = https.request(host, options, (res) => {
            let resp = Buffer.alloc(0);
            res.on('data', function (chunk) {
                resp = Buffer.concat([resp, chunk]);
            });
            res.on('end', () => {
                resp = resp.toString();
                resolve({
                    "res": res,
                    "body": resp
                });
            });
            res.on('err', () => {
                reject();
            });
        });
        newRequest.write(body);
        newRequest.end();
    });
}

function toTimestamp(date) {
    return new Date(date).getTime();
}

wrapper();