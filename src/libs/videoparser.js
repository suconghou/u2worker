const headers = new Headers({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:74.0) Gecko/20100101 Firefox/74.0',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
});
const headers_ = new Headers({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:74.0) Gecko/20100101 Firefox/74.0',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Content-Type': 'application/json'
});
const cache = new Map();
const get = (key) => {
    const item = cache.get(key);
    if (item) {
        if (item.expire > +new Date()) {
            return item.value;
        }
        else {
            expire();
        }
    }
};
const set = (key, value, ttl = 3600e3) => {
    cache.set(key, { value, expire: +new Date() + ttl });
};
const expire = () => {
    const t = +new Date();
    for (let [k, v] of cache) {
        if (v.expire < t) {
            cache.delete(k);
        }
    }
};
const ajax = async (url) => {
    let text = get(url);
    if (text) {
        return text;
    }
    if (CACHE) {
        text = await CACHE.get(url);
        if (text) {
            set(url, text);
            return text;
        }
    }
    const init = {
        headers,
        method: 'GET',
        cf: {
            cacheEverything: true,
            cacheTtl: 3600,
            cacheTtlByStatus: { '200-299': 3600, 404: 60, '500-599': 10 }
        }
    };
    const r = await fetch(url, init);
    text = await r.text();
    set(url, text);
    if (CACHE) {
        await CACHE.put(url, text, { expirationTtl: url.substr(-2) === 'js' ? 86400 : 7200 });
    }
    return text;
};
const doPost = async (url, body, cacheKey) => {
    let text = get(cacheKey);
    if (text) {
        return text;
    }
    if (CACHE) {
        text = await CACHE.get(cacheKey);
        if (text) {
            set(cacheKey, text);
            return text;
        }
    }
    const init = {
        headers: headers_,
        method: 'POST',
        body: body,
        cf: {
            cacheEverything: true,
            cacheTtl: 3600,
            cacheTtlByStatus: { '200-299': 3600, 404: 60, '500-599': 10 }
        }
    };
    const r = await fetch(url, init);
    text = await r.text();
    set(cacheKey, text);
    if (CACHE) {
        await CACHE.put(cacheKey, text, { expirationTtl: 7200 });
    }
    return text;
};

const parseQuery = (str) => {
    if (!str) {
        return {};
    }
    const pairs = (str[0] === '?' ? str.substr(1) : str).split('&');
    const params = {};
    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i].split('=');
        params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
    }
    return params;
};

class decipher {
    constructor(bodystr) {
        this.bodystr = bodystr;
        this.init();
    }
    init() {
        const bodystr = this.bodystr;
        const objResult = bodystr.match(/var ([a-zA-Z_\$][a-zA-Z_0-9]*)=\{((?:(?:[a-zA-Z_\$][a-zA-Z_0-9]*:function\(a\)\{(?:return )?a\.reverse\(\)\}|[a-zA-Z_\$][a-zA-Z_0-9]*:function\(a,b\)\{return a\.slice\(b\)\}|[a-zA-Z_\$][a-zA-Z_0-9]*:function\(a,b\)\{a\.splice\(0,b\)\}|[a-zA-Z_\$][a-zA-Z_0-9]*:function\(a,b\)\{var c=a\[0\];a\[0\]=a\[b(?:%a\.length)?\];a\[b(?:%a\.length)?\]=c(?:;return a)?\}),?\n?)+)\};/);
        if (!objResult) {
            throw new Error("objResult not match");
        }
        const funcResult = bodystr.match(/function(?: [a-zA-Z_\$][a-zA-Z_0-9]*)?\(a\)\{a=a\.split\(""\);\s*((?:(?:a=)?[a-zA-Z_\$][a-zA-Z_0-9]*\.[a-zA-Z_\$][a-zA-Z_0-9]*\(a,\d+\);)+)return a\.join\(""\)\}/);
        if (!funcResult) {
            throw new Error("funcResult not match");
        }
        const obj = objResult[1].replace(/\$/g, '\\$');
        const objBody = objResult[2].replace(/\$/g, '\\$');
        const funcBody = funcResult[1].replace(/\$/g, '\\$');
        let result = objBody.match(/(?:^|,)([a-zA-Z_\$][a-zA-Z_0-9]*):function\(a\)\{(?:return )?a\.reverse\(\)\}/m);
        const reverseKey = result ? result[1].replace(/\$/g, '\\$') : '';
        result = objBody.match(/(?:^|,)([a-zA-Z_\$][a-zA-Z_0-9]*):function\(a,b\)\{return a\.slice\(b\)\}/m);
        const sliceKey = result ? result[1].replace(/\$/g, '\\$') : '';
        result = objBody.match(/(?:^|,)([a-zA-Z_\$][a-zA-Z_0-9]*):function\(a,b\)\{a\.splice\(0,b\)\}/m);
        const spliceKey = result ? result[1].replace(/\$/g, '\\$') : '';
        result = objBody.match(/(?:^|,)([a-zA-Z_\$][a-zA-Z_0-9]*):function\(a,b\)\{var c=a\[0\];a\[0\]=a\[b(?:%a\.length)?\];a\[b(?:%a\.length)?\]=c(?:;return a)?\}/m);
        const swapKey = result ? result[1].replace(/\$/g, '\\$') : '';
        const regex = new RegExp(`(?:a=)?${obj}\\.(${[reverseKey, sliceKey, spliceKey, swapKey].filter(v => v).join('|')})\\(a,(\\d+)\\)`, 'g');
        const tokens = [];
        while ((result = regex.exec(funcBody)) !== null) {
            switch (result[1]) {
                case swapKey:
                    tokens.push(`w${result[2]}`);
                    break;
                case reverseKey:
                    tokens.push("r");
                    break;
                case sliceKey:
                    tokens.push(`s${result[2]}`);
                    break;
                case spliceKey:
                    tokens.push(`p${result[2]}`);
                    break;
            }
        }
        if (tokens.length < 1) {
            throw new Error("error parsing signature tokens");
        }
        this.tokens = tokens;
    }
    decode(s) {
        let sig = s.split('');
        let pos = 0;
        for (let tok of this.tokens) {
            if (tok.length > 1) {
                pos = ~~tok.slice(1);
            }
            switch (tok[0]) {
                case 'r':
                    sig = sig.reverse();
                    break;
                case 'w':
                    const tmp = sig[0];
                    sig[0] = sig[pos];
                    sig[pos] = tmp;
                    break;
                case 's':
                    sig = sig.slice(pos);
                    break;
                case 'p':
                    sig.splice(0, pos);
                    break;
            }
        }
        return sig.join('');
    }
}

const baseURL = 'https://www.youtube.com';
const store = new Map();
class infoParser {
    constructor(vid, fetch, doPost) {
        this.vid = vid;
        this.fetch = fetch;
        this.doPost = doPost;
        this.playerURL = "https://youtubei.googleapis.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
        this.videoPageURL = `${baseURL}/watch?v=${vid}`;
    }
    async init() {
        try {
            await this.playerParse();
        }
        catch (e) {
            await this.pageParse();
        }
    }
    async playerParse() {
        const obj = {
            "videoId": this.vid,
            "context": {
                "client": {
                    "clientName": "Android",
                    "clientVersion": "16.13.35"
                }
            }
        };
        const body = JSON.stringify(obj);
        const res = await this.doPost(this.playerURL, body, this.vid);
        const [videoDetails, streamingData] = this.extract(res);
        this.videoDetails = videoDetails;
        this.streamingData = streamingData;
    }
    async pageParse() {
        let jsPath;
        const text = await this.fetch(this.videoPageURL);
        if (!text) {
            throw new Error("get page data failed");
        }
        const jsPathReg = text.match(/"jsUrl":"(\/s\/player.*?base.js)"/);
        if (jsPathReg && jsPathReg.length == 2) {
            jsPath = jsPathReg[1];
        }
        if (jsPath) {
            store.set("jsPath", jsPath);
        }
        const arr = text.match(/ytInitialPlayerResponse\s+=\s+(.*}{3,});\s*var/);
        if (!arr || arr.length < 2) {
            throw new Error("ytInitialPlayerResponse not found");
        }
        const [videoDetails, streamingData] = this.extract(arr[1]);
        this.jsPath = jsPath || store.get("jsPath");
        this.videoDetails = videoDetails;
        this.streamingData = streamingData;
    }
    extract(text) {
        const data = JSON.parse(text);
        if (!data) {
            throw new Error("parse ytInitialPlayerResponse error");
        }
        if (!data.videoDetails || !data.playabilityStatus) {
            throw new Error("invalid ytInitialPlayerResponse");
        }
        const ps = data.playabilityStatus;
        const s = ps.status;
        if (s != "OK") {
            let reason = ps.reason || s;
            throw new Error(reason);
        }
        if (!data.streamingData) {
            throw new Error("no streamingData");
        }
        return [data.videoDetails, data.streamingData];
    }
    async parse() {
        const info = {
            'id': this.videoDetails.videoId,
            'title': this.videoDetails.title,
            'duration': this.videoDetails.lengthSeconds,
            'author': this.videoDetails.author,
        };
        const streams = {};
        info['streams'] = streams;
        if (this.error) {
            info['error'] = this.error;
            return info;
        }
        for (let item of (this.streamingData.formats || []).concat(this.streamingData.adaptiveFormats || [])) {
            const itag = String(item.itag);
            const s = {
                "quality": item.qualityLabel || item.quality,
                "type": item.mimeType.replace(/\+/g, ' '),
                "itag": itag,
                "len": item.contentLength,
                'url': await this.buildURL(item)
            };
            if (item.initRange && item.indexRange) {
                s["initRange"] = item.initRange;
                s["indexRange"] = item.indexRange;
            }
            streams[itag] = s;
        }
        return info;
    }
    async buildURL(item) {
        if (item.url) {
            return item.url;
        }
        const cipher = item.cipher ? item.cipher : item.signatureCipher;
        if (!cipher) {
            throw new Error("not found url or cipher");
        }
        const u = parseQuery(cipher);
        if (!u.url) {
            throw new Error("can not parse url");
        }
        return u.url + await this.signature(u);
    }
    async signature(u) {
        const sp = u.sp || "signature";
        if (u.s) {
            if (!this.decipher) {
                if (!this.jsPath) {
                    throw new Error("jsPath not avaiable");
                }
                const bodystr = await this.fetch(baseURL + this.jsPath);
                this.decipher = new decipher(bodystr);
            }
            const sig = this.decipher.decode(u.s);
            return `&${sp}=${sig}`;
        }
        else if (u.sig) {
            return `&${sp}=${u.sig}`;
        }
        else {
            throw new Error("can not decipher url");
        }
    }
}
class parser {
    constructor(vid, fetch, doPost) {
        this.vid = vid;
        this.fetch = fetch;
        this.doPost = doPost;
        if (!vid || typeof fetch != 'function' || typeof doPost != 'function') {
            throw new Error("invalid params");
        }
    }
    async initParser() {
        const parser = new infoParser(this.vid, this.fetch, this.doPost);
        await parser.init();
        this.parser = parser;
    }
    async info() {
        if (!this.parser) {
            await this.initParser();
        }
        return await this.parser.parse();
    }
    async infoPart(itag) {
        if (!this.parser) {
            await this.initParser();
        }
        const info = await this.parser.parse();
        const itagInfo = info.streams[itag];
        if (!itagInfo) {
            throw new Error(`itag ${itag} not found`);
        }
        return {
            'url': itagInfo['url']
        };
    }
}

class index extends parser {
    constructor(vid) {
        super(vid, ajax, doPost);
    }
}

export default index;
