const { UIKit, Kernel, FileStorage, Setting } = require("./libs/easy-jsbox")
const HomeUI = require("./ui/home")

/**
 * @typedef {AppKernel} AppKernel
 */
class AppKernel extends Kernel {
    basePath = "shared://ipa-installer"

    get tlsConfig() {
        return {
            port: 8080,
            domain: this.setting.get("tls.domain"),
            cert: this.setting.get("tls.cert"),
            key: this.setting.get("tls.key")
        }
    }

    get isReady() {
        const tc = this.tlsConfig
        return tc.domain !== "" && tc.cert !== "" && tc.key !== ""
    }

    constructor() {
        super()
        // setting
        this.setting = new Setting({ fileStorage: new FileStorage() })
        this.setting.loadConfig()
        this.initSettingEvents()
        this.initFiles()

        this.homeUI = new HomeUI(this)

        this.initServer()
    }

    initSettingEvents() {
        this.setting.appendEvent("onSet", key => {
            if (key.startsWith("tls.")) {
                $app.tips($l10n("SEE_README"))
            }
        })
    }

    initFiles() {
        if (!$file.exists(this.basePath)) {
            $file.mkdir(this.basePath)
        }
        if ($file.exists("assets/ssl")) {
            $file.delete("assets/ssl")
        }
    }

    initServer() {
        if (!this.isReady) return
        this.startServer()
        $app.listen({
            exit: () => this.stopServer()
        })
    }

    getIPAPath(name) {
        return FileStorage.join(this.basePath, name)
    }
    getRawIPAPath(name) {
        return FileStorage.join(this.getIPAPath(name), `${name}.ipa`)
    }
    getIPAContentPath(name) {
        return FileStorage.join(this.getIPAPath(name), "Content")
    }

    startServer() {
        $nodejs.run({
            path: "/scripts/libs/server.js",
            query: this.tlsConfig
        })
    }
    stopServer() {
        $nodejs.notify("stopServer")
    }

    deleteConfirm(content, conformAction) {
        $ui.alert({
            title: $l10n("CONFIRM_DELETE_TITLE"),
            message: $l10n("CONFIRM_DELETE_MSG").replace("${content}", content),
            actions: [
                {
                    title: $l10n("DELETE"),
                    style: $alertActionType.destructive,
                    handler: () => {
                        conformAction()
                    }
                },
                { title: $l10n("CANCEL") }
            ]
        })
    }
}

class AppUI {
    static renderMainUI() {
        const kernel = new AppKernel()
        kernel.useJsboxNav()
        kernel.setting.useJsboxNav()
        // 设置 navButtons
        kernel.setNavButtons([
            {
                symbol: "gear",
                handler: () => {
                    UIKit.push({
                        title: $l10n("SETTING"),
                        bgcolor: Setting.bgcolor,
                        views: [kernel.setting.getListView()]
                    })
                }
            },
            {
                symbol: "plus",
                handler: async () => {
                    const file = await $drive.open()
                    if (file) kernel.homeUI.import(file)
                }
            }
        ])

        kernel.UIRender({ views: [kernel.homeUI.getListView()] })
    }

    static renderUnsupported() {
        $intents.finish("不支持在此环境中运行")
        $ui.render({
            views: [
                {
                    type: "label",
                    props: {
                        text: "不支持在此环境中运行",
                        align: $align.center
                    },
                    layout: $layout.fill
                }
            ]
        })
    }
}

module.exports = {
    run: () => {
        if ($app.env === $env.app) {
            AppUI.renderMainUI()
        } else {
            AppUI.renderUnsupported()
        }
    }
}
