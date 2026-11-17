# ShareHub

ShareHub 是给研发团队使用的内部分享平台。最新动态按发布顺序显示。短动态、图文、代码片段和长文共用一个发布入口。发帖时可以搜索和复用已有标签。详情页支持回复评论，收藏可在「我的收藏」里查看。

## 本机预览

需要 Node.js 20.19+ 或 22.12+、Java 21 和 Maven。首次构建需要联网下载依赖。

```sh
cd server
mvn -DskipTests package
SHAREHUB_DEMO=true java -jar target/sharehub-0.1.0.jar --server.address=127.0.0.1
```

另开一个终端，从项目根目录运行：

```sh
cd web
npm ci
npm run dev
```

浏览 [本机预览](http://127.0.0.1:5173)，点「使用演示账号」。本地数据库和上传图片位于 `server/data/`，重启后仍会保留。演示账号使用独立数据目录，供本机试用。

## 内网部署

Docker Compose 方案包含 Nginx、Spring Boot 和 MySQL 8.4。启动前配置管理员和数据库密码，然后执行 `docker compose up -d --build`。

- `SHAREHUB_ADMIN_USER` 默认为 `admin`，首次启动时创建该账号。
- `SHAREHUB_ADMIN_PASSWORD` 为管理员密码，至少 12 个字符。
- `SHAREHUB_DB_PASSWORD` 和 `SHAREHUB_DB_ROOT_PASSWORD` 为数据库密码。
- 服务默认绑定 `127.0.0.1:8085`。可按内网入口配置 `SHAREHUB_BIND`，在 HTTPS 入口下设 `SHAREHUB_SECURE_COOKIE=true`。
- 应用数据在 `database` 和 `media` 两个卷中。管理员从「成员管理」给同事开通账号。

登录目前使用 ShareHub 本地账号。说明、代码和标签使用持久化存储，图片支持 PNG、JPEG 和 WebP，每条动态最多 4 张，每张最多 5 MB。
