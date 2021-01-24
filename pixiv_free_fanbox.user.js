// ==UserScript==
// @name           pixiv_free_fanbox
// @name:zh-CN        pixiv_free_fanbox
// @name:zh-TW        pixiv_free_fanbox
// @name:ja        pixiv_free_fanbox
// @name:ru        pixiv_free_fanbox
// @name:kr        pixiv_free_fanbox
// @namespace      pixiv_free_fanbox
// @description    view fanbox for free
// @description:zh-CN view fanbox for free
// @description:zh-TW view fanbox for free
// @description:ja view fanbox for free
// @description:ru view fanbox for free
// @description:kr view fanbox for free
// @include        https://*.fanbox.cc/posts/*
// @include        https://*.fanbox.cc/
// @run-at      document-start
// @grant       GM_xmlhttpRequest
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// @grant         GM_getValue
// @author      zhuzemin
// @version     1.04
// @supportURL  https://github.com/zhuzemin
// @connect-src danbooru.donmai.us
// @connect-src cse.google.com
// @connect-src yande.re
// ==/UserScript==
//config
let config = {
        'debug': false,
        'api': {
                //'google': 'https://cse.google.com/cse/element/v1?cx=a5e2ba84062470dee&q={{keyword}}&safe=off&cse_tok=AJvRUv2fkaAldGWb8xOFfG2krdXS:1611290690970&callback=google.search.cse.api6888',

                'danbooru': {
                        'base': 'https://danbooru.donmai.us',
                        'artists': '/artists.json?search[url_matches]={{keyword}}',
                        'posts': '/posts.json?tags={{keyword}}&limit=200',
                },
                'yandere': {
                        'base': 'https://yande.re',
                        'artists': '/artist.json?name={{keyword}}',
                        'posts': '/post.json?limit=100&tags={{keyword}}',
                        'artist_name': '/artist/show/{{keyword}}',
                },
        },
        'hostname': getLocation(window.location.href).hostname,
        'obj': null,
        'changed': false,
}
let debug = config.debug ? console.log.bind(console) : function () {
};
config.obj = GM_getValue(config.hostname);
for (let key in config.api) {
        for (let sub_key in config.api[key]) {
                if (sub_key != 'base') {
                        config.api[key][sub_key] = config.api[key].base + config.api[key][sub_key];
                }
        }
}
class requestObject {
        constructor(url) {
                this.method = 'GET';
                this.respType = 'json';
                this.url = url;
                this.body = null;
                this.headers = {
                        'User-agent': window.navigator.userAgent,
                        'Referer': window.location.href,
                };
        }
}


function googleHandler(resp, deprecated) {
        return new Promise(
                (resolve, reject) => {
                        const raw = resp.responseText;
                        debug(raw.replace(/(\);)|(\/\*O_o\*\/)|(google.search.cse.api6888\()/g, ''));
                        const json = JSON.parse(raw.replace(/(\);)|(\/\*O_o\*\/)|(google.search.cse.api6888\()/g, '').replace('\\', '\\\\'));
                        debug(json.cursor.resultCount);
                        if (parseInt(json.cursor.resultCount) > 0) {
                                let postId = null;
                                let matches = json.results[0].contentNoFormatting.match(/\s(\d{5,8}),/);
                                if (matches != null) {
                                        postId = matches[1];
                                }
                                else {
                                        postId = json.results[0].url.match(/\d{5,8}/)[0];

                                }
                                if (postId != null) {
                                        const url = config.api.yandere.replace('{{postId}}', postId);
                                        const obj = new requestObject(url);
                                        debug(url);
                                        resolve(obj);

                                }
                        }
                });
}

function get_artist(flag) {
        return new Promise(
                (resolve, reject) => {
                        debug('get_artist');
                        let keyword = null;
                        if (flag == 'yandere') {
                                let interval = setInterval(() => {
                                        let elem = document.querySelector('h1');
                                        if (elem.textContent != '') {
                                                clearInterval(interval);
                                                keyword = encodeURIComponent(elem.textContent);
                                                const url = config.api[flag].artists.replace('{{keyword}}', keyword);
                                                const obj = new requestObject(url);
                                                debug(url);
                                                httpRequest(obj).then(
                                                        function (result) {
                                                                if (result.response.length > 0) {
                                                                        let json = result.response[0];
                                                                        save_obj(flag, json)
                                                                        resolve('suc');

                                                                }
                                                                else {
                                                                        reject('error');
                                                                }
                                                        });
                                        }
                                }, 1000);
                        }
                        else if (flag == 'danbooru') {
                                keyword = encodeURIComponent(window.location.href);
                                const url = config.api[flag].artists.replace('{{keyword}}', keyword);
                                const obj = new requestObject(url);
                                debug(url);
                                httpRequest(obj).then(
                                        function (result) {
                                                if (result.response.length > 0) {
                                                        let json = result.response[0];
                                                        save_obj(flag, json)
                                                        resolve('suc');

                                                }
                                                else {
                                                        reject('error');
                                                }
                                        });
                        }
                });
}

function save_obj(flag, json) {
        config.obj.src[flag] = {
                'artist': json,
                'posts': null,
        };
}

function get_posts(flag) {
        debug('get_posts');
        return new Promise(
                (resolve, reject) => {
                        let count = 0;
                        const keyword = config.obj.src[flag].artist.name;
                        const url = config.api[flag].posts.replace('{{keyword}}', keyword);
                        const obj = new requestObject(url);
                        httpRequest(obj).then(
                                (result) => {
                                        config.obj.src[flag].posts = result.response;
                                        config.obj.update = Date.now();
                                        config.obj.suc++;
                                        debug('get posts finish');
                                        resolve('suc');
                                },
                                () => {
                                        debug('get posts finish');
                                        config.obj.suc++;
                                }
                        );
                });
}


function unlock() {
        debug('unlock');
        const day = 60 * 60 * 24 * 1000;
        debug(day);
        let interval = setInterval(() => {
                let parent = null;
                for (let xpath of ['//*[@id="root"]/div[5]/div[1]/div[2]/div[3]/div/div/div[1]', '/html/body/div/div[5]/div[1]/div/div[3]/div/div/div[1]']) {
                        parent = getElementByXpath(xpath);
                        if (parent != null) {
                                debug(parent.childNodes.length);
                                break;
                        }
                }
                if (parent != null && parent.childNodes.length >= 11 && !config.changed && config.obj.suc == Object.keys(config.api).length) {
                        //clearInterval(interval);
                        let pair = [];
                        for (let i = 0; i < parent.childNodes.length; i++) {
                                let child = parent.childNodes[i];
                                debug(child.className);
                                if (child.className == '') {
                                        child.addEventListener('click', () => {
                                                postsHandler();
                                        });
                                        const href = child.firstChild.lastChild.href;
                                        let info = child.firstChild.lastChild.firstChild.firstChild;
                                        debug(info.textContent);
                                        debug(info.querySelectorAll('div')[1].lastChild.textContent);
                                        const date = new Date(info.querySelectorAll('div')[1].lastChild.textContent);
                                        debug(date);
                                        let files = [];
                                        for (let key in config.obj.src) {
                                                const posts = config.obj.src[key].posts;
                                                for (let item of posts) {
                                                        let created_date = null;
                                                        if (key == 'yandere') {
                                                                debug(item.created_at * 1000);
                                                                created_date = new Date(item.created_at * 1000);
                                                        }
                                                        else if (key == 'danbooru') {
                                                                created_date = new Date(item.created_at);
                                                        }
                                                        debug(created_date);
                                                        if ((created_date > date && item.source == href) || (created_date > date && created_date - date < day)) {
                                                                let file_url = null;
                                                                let large_file_url = null;
                                                                if (key == 'danbooru') {
                                                                        file_url = item.file_url;
                                                                        large_file_url = item.large_file_url;
                                                                        debug(file_url);
                                                                }
                                                                else if (key == 'yandere') {
                                                                        file_url = item.sample_url;
                                                                        large_file_url = item.jpeg_url;
                                                                        debug(file_url);
                                                                }
                                                                files.push({
                                                                        'file_url': file_url,
                                                                        'large_file_url': large_file_url
                                                                });

                                                        }
                                                        else if (created_date < date) {
                                                                break;
                                                        }
                                                }
                                                if (files.length > 0) {
                                                        let icon = info.lastChild;
                                                        icon.innerHTML = '&#128273;&#128275;';
                                                        debug(files);
                                                        pair.push({
                                                                'href': href,
                                                                'files': files
                                                        });
                                                        break
                                                }
                                        }
                                }
                        }
                        config.obj.pair = pair;
                        GM_setValue(config.hostname, config.obj);
                        config.changed = true;
                }
        }, 1000);
}

function insert(element, file_url, large_file_url) {

        let img = document.createElement('img');
        img.style.display = 'block';
        img.style.marginLeft = 'auto';
        img.style.marginRight = 'auto';
        img.src = file_url;
        img.alt = large_file_url;
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('click', function () {
                let div = document.querySelector('#free_fanbox');
                div.firstChild.src = this.alt;
                div.style.visibility = 'visible';
        });
        const newImg = img.cloneNode(true);
        let div = document.createElement('div');
        div.id = 'free_fanbox';
        div.style = `
width:100%;
height:100%;
z-index:1000;
visibility: hidden;
background:white;
margin: auto;
display: block;
position: absolute;
top: 50%;
left: 50%;
transform: translate(-50%, -50%);
`;
        div.append(newImg);
        div.addEventListener('click', function () {
                this.style.visibility = 'hidden';
        })
        element.appendChild(img);
        element.appendChild(div);
        if (img.width > img.height) {

                img.style.width = '720px';
        } else {

                img.style.height = '731px';
        }
}

function postsHandler() {
        debug('posts');
        config.changed = false;
        debug(config.obj.pair.length);
        if (config.obj != null && config.obj.pair.length > 0) {
                $Wait('article').then(function (resolve) {
                        for (let item of config.obj.pair) {
                                debug(item.href);
                                if (item.href == window.location.href) {
                                        resolve.removeChild(resolve.lastChild);
                                        for (let file of item.files.reverse()) {
                                                insert(resolve, file.file_url, file.large_file_url);
                                        }
                                        break;
                                }
                        }
                });
        }
}

let init = function () {
        if (window.self === window.top) {
                if (/^https:\/\/\w+.fanbox.cc\/$/.test(window.location.href)) {
                        if (config.obj == null) {
                                config.obj = {
                                        src: {},
                                        update: null,
                                        pair: null,
                                        suc: 0,
                                }
                                for (let key in config.api) {
                                        debug(key);
                                        if (key == 'yandere') {
                                                get_artist(key).then(
                                                        () => {
                                                                const keyword = config.obj.src[key].artist.alias_id;
                                                                const url = config.api[key].artist_name.replace('{{keyword}}', keyword);
                                                                const obj = new requestObject(url);
                                                                debug(url);
                                                                httpRequest(obj).then(
                                                                        function (resolve) {
                                                                                let alias = resolve.finalUrl.match(/title=(.+)/)[1];
                                                                                config.obj.src[key].artist['origin_name'] = config.obj.src[key].artist.name;
                                                                                config.obj.src[key].artist.name = alias;
                                                                                debug(alias);
                                                                                get_posts(key);
                                                                        }
                                                                );

                                                        }
                                                );
                                        }
                                        else if (key == 'danbooru') {
                                                get_artist(key).then(
                                                        () => {
                                                                get_posts(key);
                                                        }
                                                );
                                        }
                                }
                        }
                        else {
                                const hour = 60 * 60 * 1000;
                                if (Date.now() - new Date(config.obj.update) > hour) {
                                        for (let key in config.api) {
                                                get_posts(key);
                                        }
                                }
                        }
                        unlock();
                }
                else {
                        postsHandler();
                }
        }
}
window.addEventListener('DOMContentLoaded', init);
/**
 * Create a user setting prompt
 * @param {string} varName
 * @param {any} defaultVal
 * @param {string} menuText
 * @param {string} promtText
 * @param {function} func
 */
function setUserPref(varName, defaultVal, menuText, promtText, func = null) {
        GM_registerMenuCommand(menuText, function () {
                var val = prompt(promtText, GM_getValue(varName, defaultVal));
                if (val === null) { return; }// end execution if clicked CANCEL
                GM_setValue(varName, val);
                if (func != null) {
                        func(val);
                }
        });
}
function httpRequest(object, timeout = 10000) {
        return new Promise(
                (resolve, reject) => {
                        GM_xmlhttpRequest({
                                method: object.method,
                                url: object.url,
                                headers: object.headers,
                                responseType: object.respType,
                                data: object.body,
                                timeout: timeout,
                                onload: function (responseDetails) {
                                        debug(responseDetails);
                                        //Dowork
                                        resolve(responseDetails);
                                },
                                ontimeout: function (responseDetails) {
                                        debug(responseDetails);
                                        //Dowork
                                        reject(responseDetails);

                                },
                                ononerror: function (responseDetails) {
                                        debug(responseDetails);
                                        //Dowork
                                        reject(responseDetails);

                                }
                        });
                }
        )
}
function $Wait(Selector, Timeout = 15000) {
        return new Promise(resolve => {
                let Interval = setInterval(() => {
                        let DQS = document.querySelector(Selector);
                        if (DQS) {
                                resolve(DQS);
                                clearInterval(Interval);
                        }
                }, 0);
                setTimeout(() => {
                        resolve(null);
                        clearInterval(Interval);
                }, Timeout);
        });
}

function getElementByXpath(path) {
        return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

function getLocation(href) {
        let l = document.createElement("a");
        l.href = href;
        return l;
};
