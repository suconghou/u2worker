## cloudflare worker

`videoparser` 来自项目 `ujparse`

多级缓存设计,`cache-control`都是用小写格式,方便替换

支持两种运行模式


`handlers/video.js`里的`baseURL`不为空时,接口地址负责解析,`make build`生成的脚本依赖解析接口


修改`baseURL`为空,不使用外部接口解析

`make build`将生成无依赖的,使用`videoparser`解析数据的worker,可直接复制到cf worker编辑器中.


子项目

1. cf优化版视频解析服务 https://github.com/suconghou/ujparse










