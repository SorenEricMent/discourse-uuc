const https = require("https");

const config = {
    "user_agent": "Discourse-uuc/1.0 By/SorenEricMent",
    "account_list": [
        {
            "username": "Impostor",
            "password": "Lasagna"
        }
    ],
    "url": "some.sus.forum",
    "time_range": {
        "start": "1989-06-05",
        "end": "9999-12-31"
    },
    "interval": {
        "post_list_fetch": 2000,
        "post_load": 2000
    }
}

async function wrapper(){
    console.log("Discourse-uuc by Winslow SorenEricMent");
    console.log("A script that stat users under a certain category");
}
function loginAccounts(account_list){
    let getCSRF = new Promise((resolve,reject)=>{
        let requestData = {
            "headers": {
                "x-csrf-token": "undefined",
              },
              "referrer": host + "/login",
              "referrerPolicy": "strict-origin-when-cross-origin",
              "body": null,
              "method": "GET",
              "mode": "cors",
              "credentials": "omit"
        };
        requestData = mergeJSON(requestData,gHeader);
        https.get(host + "/session/csrf", requestData, (res) => {
            let response = Buffer.alloc(0);
            res.on('data', function (chunk) {
                response = Buffer.concat([response, chunk]);
            });
            res.on('end', () => {
                response = response.toString();
                let data = JSON.parse(response);
                if(data.hasOwnProperty("csrf")){
                    resolve([data.csrf,cookieParser(res.headers["set-cookie"])]);
                }else{
                    reject("Failed to request CSRF Token, login failed.");
                }
            });
        });
    });
    let login = function(){
        return new Promise((resolve,reject)=>{
            d.login.csrf(host).then((answer) => {
                let cookie = cookieRestore(answer[1]);
                let un = encodeURIComponent(username);
                let p = encodeURIComponent(password);
                d.login.session(host,answer[0],un,p,cookie).then((result) => {
                    resolve(result);
                }
                ).catch((err) => {
                    console.log(err);
                    reject(err);
                }
                );
            });
        });
    }
    return new Promise((resolve,reject)=>{
        let offset = 0;
        let promises = [];
        for(const element of credentials){
            promises.push(api.login(element.host,element.username,element.password));
        }
        Promise.allSettled(promises).then((results) => {
            let users = {
                "success": [],
                "failure": []
            };
            console.log(results);
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
function invokeGet(url, cookie){
    let data = {
        "headers": {
          "user-agent": config.user_agent,
          "Cookie": cookie
        },
        "credentials": "include"
      };

    let resp = Buffer.alloc(0);
    return new Promise((resolve, reject) => {
        https.get(url, data, res => {
            res.on('data', function (chunk) {
                response = Buffer.concat([response, chunk]);
            });
            res.on('end', () => {
                response = response.toString();
                resolve(JSON.parse(response));
            });
        }).on('error', err => {
            reject(err);
        });
    });
}

function toTimestamp(date){
    let timestamp = new Date(date).getTime();
    return timestamp;
}

wrapper();