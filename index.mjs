import { default as https } from 'https';

//Edit it to your own configuation. Or feed winslow with lasagna.
const config = {
    "user_agent": "Discourse-uuc/1.0 By/WinslowSEM",
    "account_list": [
        {
            "username": "winslow",
            "password": "ILoveLasagna"
        }
    ],
    "host": "https://limelight.moe",
    "category": "/c/anonymous/58",
    "time_range": {
        "start": "1989-06-05",
        "end": "9999-12-31"
    },
    "interval": {
        "login": 3000,
        "post_list_fetch": 2000,
        "post_load": 2000,
        "limit": {
            "post_list_fetch": 2000,
            "post_load": 2000
        } //This script will reduce the interval to accelerate the fetching process if multiple accounts are provided. This could limit such optimization.
    }
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
        let pageCounter = 1;
        let postIDList =  [];
        let listLength = account_list.length;
        let startTimestamp = toTimestamp(config.time_range.start);
        let endTimestamp = toTimestamp(config.time_range.end);
        var fetchPostLoop = setInterval(() => {
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
            invokeGet(currentUrl, requestData).then((data) => {
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
                }
                data.body = JSON.parse(data.body);
                if (data.body.hasOwnProperty("topic_list")) {
                    console.log("Fetching page " + pageCounter);
                    let topic_list = data.body.topic_list.topics;
                    for (const topic of topic_list) {
                        if (topic.hasOwnProperty("id")) {
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
        }, config.interval.post_list_fetch / account_list.length > config.interval.limit.post_list_fetch ? config.interval.post_list_fetch / account_list.length : config.interval.limit.post_list_fetch);
    
    })
}

function userInPostFetch(id, account_list){
    let userSet = new Set();

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
    let timestamp = new Date(date).getTime();
    return timestamp;
}

wrapper();