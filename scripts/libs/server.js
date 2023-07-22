const https = require("https")
const fs = require("fs")
const path = require("path")

const basePath = path.dirname(path.dirname($jsbox.path.current))

const server = https.createServer(
    {
        key: $context.query.key,
        cert: $context.query.cert
    },
    (request, response) => {
        const requestUrl = decodeURI(request.url)

        if (requestUrl.endsWith("app.plist")) {
            const ipaName = requestUrl.split("/")[1]
            let content = fs.readFileSync(path.join(basePath, "/assets/app.plist")).toString()
            content = content.replace("${host}", `${$context.query.domain}:${$context.query.port}`)
            content = content.replace("${ipa}", ipaName)
            content = content.replace("${title}", ipaName.substring(0, ipaName.indexOf("@")))
            content = content.replace("${bundle-identifier}", ipaName.substring(ipaName.indexOf("@") + 1))

            response.statusCode = 200
            response.write(content)
            response.end()
        } else if (requestUrl.startsWith("/ipa")) {
            const ipaName = requestUrl.split("/")[2]
            const filePath = path.join($jsbox.path.shared, `/ipa-installer/${ipaName}/${ipaName}.ipa`)
            response.statusCode = 200
            // 建立流对象，读文件
            const stream = fs.createReadStream(filePath)
            stream.on("error", () => {
                response.statusCode = 500
                response.end()
            })
            // 读取文件
            stream.pipe(response)
        } else {
            const ipaName = requestUrl.split("/")[1]
            let content = fs.readFileSync(path.join(basePath, "/assets/index.html")).toString()
            const url = `https://${$context.query.domain}:${$context.query.port}/${ipaName}/app.plist`
            content = content.replace("${plistUrl}", `itms-services://?action=download-manifest&url=${url}`)
            content = content.replace("${ipaName}", ipaName.substring(0, ipaName.indexOf("@")))

            response.statusCode = 200
            response.end(content)
        }
    }
)

server.listen($context.query.port)

$jsbox.listen("stopServer", () => {
    server.close()
    console.log("server closed")
})