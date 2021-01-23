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
// @version     1.00
// @supportURL  https://github.com/zhuzemin
// @connect-src danbooru.donmai.us
// @connect-src cse.google.com
// @connect-src yande.re
// ==/UserScript==
//config
let config = {
        'debug': false,
        'api': {
                'google': 'https://cse.google.com/cse/element/v1?cx=a5e2ba84062470dee&q={{keyword}}&safe=off&cse_tok=AJvRUv2fkaAldGWb8xOFfG2krdXS:1611290690970&callback=google.search.cse.api6888',

                'danbooru': {
                        'enable': false,
                        'base': 'https://danbooru.donmai.us',
                        'artists': '/artists.json?search[url_matches]={{keyword}}',
                        'posts': '/posts.json?tags={{keyword}}&limit=200',
                },
                'yandere': {
                        'enable': false,
                        'base': 'https://yande.re',
                        'artists': '/artist.json?name={{keyword}}',
                        'posts': '/post.json?limit=100&tags={{keyword}}',
                        'artist_name': '/artist/show/{{keyword}}',
                },
                'current': null,
        },
        'hostname': getLocation(window.location.href).hostname,
        'obj': null,
        'changed': false,
}
let debug = config.debug ? console.log.bind(console) : function () {
};

toggle();
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

function toggle(init = true) {
        if (init) {
                debug('init');
                let count = 0;
                for (let key in config.api) {
                        count++;
                        debug(key);
                        const hostname = key + '_' + config.hostname;
                        debug(hostname);
                        config.obj = GM_getValue(hostname) || null;
                        if (config.obj != null || count == 3) {
                                let item = config.api[key];
                                item.enable = true;
                                config.hostname = hostname;
                                config.api.current = item;
                                break;
                        }
                }

        }
        else {
                debug('switch');
                if (!config.api.yandere.enable) {
                        config.api.yandere.enable = true;
                        config.api.danbooru.enable = false;
                        config.api.current = config.api.yandere;
                        config.hostname = 'yandere_' + getLocation(window.location.href).hostname;
                        config.obj = GM_getValue(config.hostname) || null;
                }
                else if (!config.api.danbooru.enable) {
                        config.api.danbooru.enable = true;
                        config.api.yandere.enable = false;
                        config.api.current = config.api.danbooru;
                        config.hostname = 'danbooru_' + getLocation(window.location.href).hostname;
                        config.obj = GM_getValue(config.hostname) || null;
                }
        }
        config.api.current.artists = config.api.current.base + config.api.current.artists;
        config.api.current.posts = config.api.current.base + config.api.current.posts;
        config.api.current.artist_name = config.api.current.base + config.api.current.artist_name;
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

function get_artist(json = null) {
        return new Promise(
                (resolve, reject) => {
                        debug('get_artist');
                        if (json == null) {
                                let keyword = null;
                                if (config.api.yandere.enable) {
                                        //keyword = encodeURIComponent(document.title.replace('｜pixivFANBOX', ''));
                                        let interval = setInterval(() => {
                                                let elem = document.querySelector('h1');
                                                if (elem.textContent != '') {
                                                        clearInterval(interval);
                                                        keyword = encodeURIComponent(elem.textContent);
                                                        const url = config.api.current.artists.replace('{{keyword}}', keyword);
                                                        const obj = new requestObject(url);
                                                        debug(url);
                                                        httpRequest(obj).then(
                                                                function (result) {
                                                                        if (result.response.length > 0) {
                                                                                let json = result.response[0];
                                                                                config.obj = {
                                                                                        'artist': json,
                                                                                        'posts': null,
                                                                                        'update': null,
                                                                                        'pair': null,
                                                                                }
                                                                                GM_setValue(config.hostname, config.obj);
                                                                                resolve(config.obj.artist);

                                                                        }
                                                                        else {
                                                                                reject('error');
                                                                        }
                                                                });
                                                }
                                        }, 1000);
                                }
                                else if (config.api.danbooru.enable) {
                                        keyword = encodeURIComponent(window.location.href);
                                        const url = config.api.current.artists.replace('{{keyword}}', keyword);
                                        const obj = new requestObject(url);
                                        debug(url);
                                        httpRequest(obj).then(
                                                function (result) {
                                                        if (result.response.length > 0) {
                                                                let json = result.response[0];
                                                                config.obj = {
                                                                        'artist': json,
                                                                        'posts': null,
                                                                        'update': null,
                                                                        'pair': null,
                                                                }
                                                                GM_setValue(config.hostname, config.obj);
                                                                resolve(config.obj.artist);

                                                        }
                                                        else {
                                                                reject('error');
                                                        }
                                                });
                                }

                        }
                        else {
                                config.obj = {
                                        'artist': json,
                                        'posts': null,
                                        'update': null,
                                        'pair': null,
                                }
                                GM_setValue(config.hostname, config.obj);
                                resolve(config.obj.artist);

                        }
                });
}

function get_posts(artist) {
        debug('get_posts');
        return new Promise(
                (resolve, reject) => {
                        const keyword = artist.name;
                        const url = config.api.current.posts.replace('{{keyword}}', keyword);
                        const obj = new requestObject(url);
                        httpRequest(obj).then(
                                function (result) {
                                        const json = result.response;
                                        config.obj.posts = json;
                                        config.obj.update = Date.now();
                                        GM_setValue(config.hostname, config.obj);
                                        resolve(config.obj.posts);
                                });
                });
}


function unlock(json) {
        debug('unlock');
        const day = 60 * 60 * 24 * 1000;
        debug(day);
        let interval = setInterval(() => {
                let parent = getElementByXpath('/html/body/div/div[5]/div[1]/div/div[3]/div/div/div[1]');
                debug(parent.childNodes.length);
                if (parent != null && parent.childNodes.length >= 11 && !config.changed) {
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
                                        for (let item of json) {
                                                let created_date = null;
                                                if (config.api.yandere.enable) {
                                                        debug(item.created_at * 1000);
                                                        created_date = new Date(item.created_at * 1000);
                                                }
                                                else if (config.api.danbooru.enable) {
                                                        created_date = new Date(item.created_at);
                                                }
                                                debug(created_date);
                                                if (created_date > date && created_date - date < day) {
                                                        let file_url = null;
                                                        let large_file_url = null;
                                                        if (config.api.danbooru.enable) {
                                                                file_url = item.file_url;
                                                                large_file_url = item.large_file_url;
                                                                debug(file_url);
                                                        }
                                                        else if (config.api.yandere.enable) {
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
                                if (config.api.yandere.enable) {
                                        get_artist().then(
                                                function (resolve) {
                                                        let json = resolve;
                                                        const keyword = json.alias_id;
                                                        const url = config.api.current.artist_name.replace('{{keyword}}', keyword);
                                                        const obj = new requestObject(url);
                                                        debug(url);
                                                        httpRequest(obj).then(
                                                                function (resolve) {
                                                                        let alias = resolve.finalUrl.match(/title=(.+)/)[1];
                                                                        json.origin_name = json.name;
                                                                        json.name = alias;
                                                                        debug(alias);
                                                                        get_artist(json).then(
                                                                                function (resolve) {
                                                                                        let artist = resolve;
                                                                                        debug(artist.name);
                                                                                        get_posts(artist).then(
                                                                                                (resolve) => {
                                                                                                        unlock(resolve);
                                                                                                }
                                                                                        );
                                                                                }
                                                                        );
                                                                }
                                                        );

                                                },
                                                (reject) => {
                                                        debug(reject);
                                                        toggle(false);
                                                        get_artist().then(
                                                                function (resolve) {
                                                                        let artist = resolve;
                                                                        debug(artist.name);
                                                                        get_posts(artist).then(
                                                                                (resolve) => {
                                                                                        unlock(resolve);
                                                                                }
                                                                        );
                                                                }
                                                        );

                                                }
                                        );
                                }
                                else {
                                        get_artist().then(
                                                function (resolve) {
                                                        let artist = resolve;
                                                        debug(artist.name);
                                                        get_posts(artist).then(
                                                                (resolve) => {
                                                                        unlock(resolve);
                                                                }
                                                        );
                                                }
                                        );
                                }
                        }
                        else {
                                const hour = 60 * 60 * 1000;
                                if (Date.now() - new Date(config.obj.update) > hour) {
                                        debug(config.obj.artist.name);
                                        get_posts(config.obj.artist).then(
                                                (resolve) => {
                                                        unlock(resolve);
                                                }
                                        );
                                }
                                else {
                                        unlock(config.obj.posts);
                                }
                        }
                }
                else {
                        postsHandler();
                }
        }
}
window.addEventListener('load', init);
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
