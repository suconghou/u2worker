import Router from './router'
import img from './handlers/img'
import video, { videoInfo } from './handlers/video'

addEventListener("fetch", event => {
    event.respondWith(handleRequest(event))
})

async function handleRequest(event) {
    let response;
    try {

        const r = new Router()

        r.get(/^\/video\/([\w\-]{6,12})\.(jpg|webp)$/, img)
        r.get(/^\/video\/([\w\-]{6,12})\.json$/, videoInfo)
        r.get(/^\/video\/([\w\-]{6,12})\/(\d{1,3})\/(\d+-\d+)\.ts$/, video)

        response = await r.route(event)

        if (!response) {
            response = new Response('Not Found', { status: 404 })
        }

        return response
    } catch (err) {
        response = new Response(err.stack || err, { status: 500 })
        return response
    }

}