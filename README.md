## cloudflare worker

`videoparser` 来自项目 `ujparse`

多级缓存设计,`cache-control`都是用小写格式,方便替换

支持两种运行模式


`handlers/video.js`里的`baseURL`不为空时,接口地址负责解析,`make build`生成的脚本依赖解析接口


修改`baseURL`为空,不使用外部接口解析(默认如此,推荐方式)

`make build`将生成无依赖的,使用`videoparser`解析数据的worker,可直接复制到cf worker编辑器中.


你也可以直接使用release的文件无需自己构建

子项目

1. cf优化版视频解析服务 https://github.com/suconghou/ujparse

### API

similar to https://github.com/suconghou/videoproxy

as it is a subset of videoproxy, it has three api

```javascript
r.get(/^\/video\/([\w\-]{6,12})\.(jpg|webp)$/, img)
r.get(/^\/video\/([\w\-]{6,12})\.json$/, videoInfo)
r.get(/^\/video\/([\w\-]{6,12})\/(\d{1,3})\/(\d+-\d+)\.ts$/, video)
```


### quick start


Login https://workers.cloudflare.com/ and create a worker 

or click `Quick edit` on your existing worker to open the online editor

download latest release `index.js` https://github.com/suconghou/u2worker/releases

paste all text value of `index.js`

then `Save and Deploy` 

you will get your worker domain, such as `https://stream.pull.workers.dev`

open https://video.feds.club/setting 

fill `{worker doamin}/video` such as `https://stream.pull.workers.dev/video` into `视频解析服务`

reload the page , watch some video, it should work

if not , use `Chrome DevTools` to see what's happening

