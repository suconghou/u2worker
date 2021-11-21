import { applyRequest } from '../utils/util'


const imageMap = {
    "jpg": "http://i.ytimg.com/vi/",
    "webp": "http://i.ytimg.com/vi_webp/"
}

export default async event => {
    const matches = event.request.url.match(/\/video\/([\w\-]{6,12})\.(jpg|webp)/)
    const vid = matches[1]
    const ext = matches[2]
    const target = imageMap[ext] + vid + "/mqdefault." + ext
    const headers = {
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36'
    };
    const init = {
        method: 'GET',
        headers,
        cf: {
            cacheEverything: true,
            cacheTtl: 864000,
            cacheTtlByStatus: { '200-299': 864000, 404: 60, '500-599': 10 }
        }
    }
    return await applyRequest(event, target, init)
}