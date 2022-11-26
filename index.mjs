import {default as https} from 'https';

//Edit it to your own configuation. Or feed winslow with lasagna.
const config = {
    "user_agent": "Discourse-uuc/1.0 By/WinslowSEM",
    "account_list": [
        {
            "username": "Impostor",
            "password": "Lasagna"
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
        "post_load": 2000
    }
};




const gHeader = {
    "headers":{
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

function cookieParser(raw){
    var cookies = {
        "complex":{},
        "flag":[],
    };
    let parser = function(str){
        let keyArray = str.split(";");
        for(const element of keyArray){
        if(element.indexOf("=") === -1){
            cookies.flag.push(element);
        }else{
            let keyValue = element.split("=");
            cookies.complex[keyValue[0]] = keyValue[1];
        }
        }
    }
    if(isArray(raw)){
        for(const element of raw){
            parser(element);
        }
    }else{
        parser(raw);
    } 
    return cookies;
}

function isArray(obj){
    return Object.prototype.toString.call(obj) === "[object Array]";
}

function cookieRestore(obj){
    let cookie = "";
    for(const key in obj.complex){
        cookie += key + "=" + obj.complex[key] + ";";
    }
    return cookie;
}

function cookieExtract(raw){
    let cookie = {
        "_t": "",
        "_forum_session": ""
    };
    for(const element of raw){
        if(element.substring(0,3) === "_t="){
            cookie._t = cookieParser(element).complex["_t"];
        }else if(element.substring(0,4) === "_for"){
            cookie._forum_session = cookieParser(element).complex["_forum_session"];
        }
    }
    return `_t=${cookie._t}; _forum_session=${cookie._forum_session}`;
}

function mergeJSON(origin,override){
    for(const key in override){
        if(typeof override[key] === "object"){
            if(isArray(override[key])){
                origin[key] = override[key];
            }else{
                mergeJSON(origin[key],override[key]);
            }
        }else{
            origin[key] = override[key];
        }
    }
    return origin;
}



async function wrapper(){
    console.log("Discourse-uuc by Winslow SorenEricMent");
    console.log("A script that stat users under a certain category");
    loginAccounts(
        [{
            "username": "winslow",
            "password": "LIMELIGHThyc233_"
        }]
    ).then(res => {
        console.log(res);
    });
}

function loginAccounts(credentials){
    let getCSRF = function(){
        return new Promise((resolve,reject)=>{
            let requestData = {
                "headers": {
                    "X-CSRF-Token": "undefined"
                },
                "referrer": config.host + "/session/csrf",
                "method": "GET",
                "mode": "cors",
                "credentials": "omit"
            };
            requestData = mergeJSON(requestData,gHeader);
            invokeGet(config.host + "/session/csrf", requestData).then((data)=>{
                data.body = JSON.parse(data.body);
                if(data.body.hasOwnProperty("csrf")){
                    resolve([data.body.csrf,cookieParser(data.res.headers["set-cookie"])]);
                }else{
                    reject("Failed to request CSRF Token, login failed.");
                }
            });
        });
    }
    
    let session = function(csrf, username, password, cookie){
        return new Promise((resolve,reject)=>{
            let requestData = {
                "headers": {
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "x-csrf-token": csrf,
                    "cookie": cookie,
                    "Referer": config.host + "/login",
                },
                "method": "POST"
            };
            requestData = mergeJSON(requestData,gHeader);
            let body = "login=" + username + "&password=" + password + "&second_factor_method=1&timezone=Asia%2FShanghai";
            invokeReq(config.host + "/session", body, requestData).then(res => {
                resolve(cookieExtract(res.res.rawHeaders));
            });
        });
    }

    let login = function(username, password){
        return new Promise((resolve,reject)=>{
            getCSRF(config.host).then((answer) => {
                let cookie = cookieRestore(answer[1]);
                let un = encodeURIComponent(username);
                let p = encodeURIComponent(password);
                session(answer[0],un,p,cookie).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            });
        });
    }

    return new Promise((resolve,reject)=>{
        let offset = 0;
        let promises = [];
        for(const element of credentials){
            promises.push(login(element.username,element.password));
        }
        Promise.allSettled(promises).then((results) => {
            let users = {
                "success": [],
                "failure": []
            };
            for(const element of results){
                if(element.status === "fulfilled"){
                    users.success.push(element.value);
                }else{
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

function getPostList(url){

}

function invokeGet(host, data){
    return new Promise((resolve, reject) => {
        let resp = Buffer.alloc(0);
        https.get(host, data, res => {
            res.on('data', function (chunk) {
                resp = Buffer.concat([resp, chunk]);
            });
            res.on('end', () => {
                resp = resp.toString();
                resolve({
                    "res":res,
                    "body": resp
                });
            });
        }).on('error', err => {
            reject(err);
        });
    });
}

function invokeReq(host,body,options){
    return new Promise((resolve, reject) => {
        let newRequest = https.request(host,options,(res) => {
            let resp = Buffer.alloc(0);
            res.on('data', function (chunk) {
                resp = Buffer.concat([resp, chunk]);
            });
            res.on('end', () => {
                resp = resp.toString();
                resolve({
                    "res":res,
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

function toTimestamp(date){
    let timestamp = new Date(date).getTime();
    return timestamp;
}

wrapper();