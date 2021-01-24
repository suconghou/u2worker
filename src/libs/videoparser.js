const headers = new Headers({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:74.0) Gecko/20100101 Firefox/74.0',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
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
    constructor(jsPath, fetch) {
        this.jsPath = jsPath;
        this.fetch = fetch;
    }
    async init() {
        const bodystr = await this.fetch(this.jsPath);
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
    async decode(s) {
        if (!this.tokens) {
            await this.init();
        }
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
class infoGetter {
    async parse(itagURL) {
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
        for (let item of this.streamingData.formats) {
            const itag = String(item.itag);
            const s = {
                "quality": item.qualityLabel || item.quality,
                "type": item.mimeType.replace(/\+/g, ' '),
                "itag": itag,
                "len": item.contentLength,
            };
            if (itagURL == itag) {
                s['url'] = await this.buildURL(item);
            }
            streams[itag] = s;
        }
        for (let item of this.streamingData.adaptiveFormats) {
            const itag = String(item.itag);
            const s = {
                "quality": item.qualityLabel || item.quality,
                "type": item.mimeType.replace(/\+/g, ' '),
                "itag": itag,
                "len": item.contentLength,
                "initRange": item.initRange,
                "indexRange": item.indexRange
            };
            if (itagURL == itag) {
                s['url'] = await this.buildURL(item);
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
            if (!this.jsPath) {
                throw new Error("jsPath not avaiable");
            }
            const d = new decipher(baseURL + this.jsPath, this.fetch);
            const sig = await d.decode(u.s);
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
class pageParser extends infoGetter {
    constructor(vid, fetch) {
        super();
        this.vid = vid;
        this.fetch = fetch;
        this.videoPageURL = `${baseURL}/watch?v=${vid}`;
    }
    async init() {
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
        let videoDetails;
        let streamingData;
        try {
            let hasJsPath;
            [hasJsPath, videoDetails, streamingData] = this.extract1(text);
            if (!jsPath) {
                jsPath = hasJsPath;
            }
        }
        catch (e) {
            console.error(e, "try extract2");
            [videoDetails, streamingData] = this.extract2(text);
        }
        this.jsPath = jsPath || store.get("jsPath");
        this.videoDetails = videoDetails;
        this.streamingData = streamingData;
    }
    extract1(text) {
        const arr = text.match(/ytplayer\.config\s*=\s*({.+?});ytplayer/);
        if (!arr || arr.length < 2) {
            throw new Error("ytplayer config not found");
        }
        const data = JSON.parse(arr[1]);
        let player_response;
        let jsPath;
        const args = data.args;
        const assets = data.assets;
        if (!args) {
            throw new Error("not found player_response");
        }
        if (assets && assets.js) {
            jsPath = assets.js;
        }
        if (jsPath) {
            store.set("jsPath", jsPath);
        }
        player_response = JSON.parse(args.player_response);
        if (!player_response.streamingData || !player_response.videoDetails) {
            throw new Error("invalid player_response");
        }
        return [jsPath, player_response.videoDetails, player_response.streamingData];
    }
    extract2(text) {
        const arr = text.match(/ytInitialPlayerResponse\s+=\s+(.*\]});.*?var/);
        if (!arr || arr.length < 2) {
            throw new Error("initPlayer not found");
        }
        const data = JSON.parse(arr[1]);
        if (!data) {
            throw new Error("parse initPlayer error");
        }
        if (!data.streamingData || !data.videoDetails) {
            throw new Error("invalid initPlayer");
        }
        return [data.videoDetails, data.streamingData];
    }
}
class infoParser extends infoGetter {
    constructor(vid, fetch) {
        super();
        this.vid = vid;
        this.fetch = fetch;
        this.videoInfoURL = `${baseURL}/get_video_info?video_id=${vid}`;
    }
    async init() {
        const data = parseQuery(await this.fetch(this.videoInfoURL));
        if (data.status !== 'ok') {
            throw new Error(`${data.status}:code ${data.errorcode},reason ${data.reason}`);
        }
        const player_response = JSON.parse(data.player_response);
        if (!player_response) {
            throw new Error("empty player_response");
        }
        const ps = player_response.playabilityStatus;
        if (['UNPLAYABLE', 'LOGIN_REQUIRED', 'ERROR'].includes(ps.status)) {
            // 私享视频 视频信息都获取不到,必须终止
            const { reason, errorScreen } = ps;
            let subreason = reason || ps.status;
            if (errorScreen && errorScreen.playerErrorMessageRenderer && errorScreen.playerErrorMessageRenderer.subreason) {
                const r = errorScreen.playerErrorMessageRenderer.subreason.runs;
                let s = '';
                if (r && r[0] && r[0].text) {
                    s = ' ' + r[0].text;
                }
                subreason += s;
            }
            subreason = subreason.replace(/\+/g, ' ');
            if (['LOGIN_REQUIRED', 'ERROR'].includes(ps.status)) {
                throw new Error(subreason);
            }
            this.error = subreason;
        }
        this.videoDetails = player_response.videoDetails;
        this.streamingData = player_response.streamingData;
        this.jsPath = store.get("jsPath");
    }
}
class parser {
    constructor(vid, fetch) {
        this.vid = vid;
        this.fetch = fetch;
        if (!vid || typeof fetch != 'function') {
            throw new Error("invalid params");
        }
    }
    async initParser() {
        try {
            const parser = new pageParser(this.vid, this.fetch);
            await parser.init();
            this.parser = parser;
        }
        catch (e) {
            console.error(e, ' , try infoParser');
            const parser = new infoParser(this.vid, this.fetch);
            await parser.init();
            this.parser = parser;
        }
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
        const info = await this.parser.parse(itag);
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
        super(vid, ajax);
    }
}

export default index;
