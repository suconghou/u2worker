import { applyRequest, get, set } from '../utils/util'
import videoParser from '../libs/videoparser'


const init = {
    "method": "GET",
    "headers": {
        'User-Agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36"
    },
    "cf": {
        cacheEverything: true,
        cacheTtl: 864000,
        cacheTtlByStatus: { '200-299': 864000, 404: 60, '500-599': 10 },
    }
}

const headers = {
    'Access-Control-Allow-Origin': '*'
}

export default async event => {
    const start = Date.now()
    const matches = event.request.url.match(/\/video\/([\w\-]{6,12})\/(\d{1,3})\/(\d+-\d+)\.ts/)
    const vid = matches[1]
    const itag = matches[2]
    const cacheKey = `${vid}/${itag}`
    let cacheItem = get(cacheKey)
    if (cacheItem) {
        const c = { ...headers, 'cache-control': `public,max-age=88888${Date.now() - start}` };
        return applyRequest(event, `${cacheItem.url}&range=${matches[3]}`, init, c)
    }
    try {
        cacheItem = await videoURLParse(vid, itag)
    } catch (e) {
        return new Response(JSON.stringify({ code: -1, msg: e.message || e.stack || e }), { status: 500, headers })
    }
    if (!cacheItem.url) {
        return new Response("invalid url", { status: 500, headers })
    }
    set(cacheKey, cacheItem)
    const c = { ...headers, 'cache-control': `public,max-age=999${(+new Date() - start)}` }
    return applyRequest(event, `${cacheItem.url}&range=${matches[3]}`, init, c)
}


export const videoInfo = async event => {
    const matches = event.request.url.match(/\/video\/([\w\-]{6,12})\.json/)
    const vid = matches[1]
    try {
        return await videoInfoParse(vid)
    } catch (e) {
        return new Response(JSON.stringify({ code: -1, msg: e.message || e.stack || e }), { status: 200, headers })
    }
}

const videoURLParse = async (vid, itag) => {
    const parser = new videoParser(vid)
    const info = await parser.infoPart(itag)
    return info
}

const videoInfoParse = async (vid) => {
    const start = +new Date()
    let info = get(vid)
    if (!info) {
        const parser = new videoParser(vid)
        info = await parser.info()
        set(vid, info)
    }
    for (const item of Object.values(info.streams || {})) {
        delete item.url
    }
    const init = {
        status: 200,
        headers: {
            ...headers,
            'Content-Type': 'application/json',
            'cache-control': `public,max-age=9999${(+new Date() - start)}`
        },
    }
    return new Response(JSON.stringify(info), init)
}
