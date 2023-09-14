const https = require("https")
const fs = require("fs")
const path = require("path")
const ui = require("ui")
const safari = require("safari")

const basePath = path.dirname(path.dirname($jsbox.path.current))
let ipaName

const server = https.createServer(
    {
        key: $context.query.key,
        cert: $context.query.cert
    },
    (request, response) => {
        const requestUrl = request.url

        const action = requestUrl.split("/")[1]

        if (action === "app.plist") {
            let content = fs.readFileSync(path.join(basePath, "/assets/app.plist")).toString()
            content = content.replace("${host}", `${$context.query.domain}:${$context.query.port}`)
            content = content.replace("${title}", ipaName.substring(0, ipaName.indexOf("@")))
            content = content.replace("${bundle-identifier}", ipaName.substring(ipaName.indexOf("@") + 1))

            response.statusCode = 200
            response.write(content)
            response.end()
        } else if (action === "ipa") {
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
            ui.success("安装完成")
        } else if (action === "html") {
            let content = fs.readFileSync(path.join(basePath, "/assets/index.html")).toString()
            const url = `https://${$context.query.domain}:${$context.query.port}/app.plist`
            const itmsServices = `itms-services://?action=download-manifest&url=${url}`
            content = content.replace("${plistUrl}", itmsServices)
            content = content.replace("${ipaName}", ipaName)

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

$jsbox.listen("install", ({ name } = {}) => {
    ipaName = name
    const url = `https://${$context.query.domain}:${$context.query.port}/html`
    safari.open(url)
})
