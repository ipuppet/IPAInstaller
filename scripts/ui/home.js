const { UIKit, FileStorage, Plist } = require("../libs/easy-jsbox")

/**
 * @typedef {import("../app").AppKernel} AppKernel
 */

class HomeUI {
    iconSize = 50
    iconPadding = 10
    titleFont = $font(16)
    titleFontSize = UIKit.getContentSize(this.titleFont)
    infoFont = $font(12)
    infoFontSize = UIKit.getContentSize(this.infoFont)

    /**
     * @param {AppKernel} kernel
     */
    constructor(kernel) {
        this.kernel = kernel

        this.listId = "home-list"

        this.kernel.setting.appendEvent("onSet", key => {
            if (key === "general.showAppleID") {
                this.updateList()
            }
        })
    }

    getPlist(name) {
        const plist = FileStorage.join(this.kernel.getIPAContentPath(name), `iTunesMetadata.plist`)
        const content = $file.read(plist)?.string
        return Plist.get(content)
    }

    deleteIPA(name) {
        $file.delete(this.kernel.getIPAPath(name))
    }

    async import(ipa) {
        const loading = UIKit.loading()
        loading.start()
        await $wait(0.5)
        const name = ipa.fileName
        $file.mkdir(this.kernel.getIPAPath(name))
        $file.write({
            data: ipa,
            path: this.kernel.getRawIPAPath(name)
        })
        const success = await $archiver.unzip({
            path: this.kernel.getRawIPAPath(name),
            dest: this.kernel.getIPAContentPath(name)
        })
        if (!success) throw new Error("Extract ipa file failed: " + name)

        const plist = this.getPlist(name)
        const ipaName = `${plist.bundleDisplayName}@${plist.softwareVersionBundleId}`
        // 先改 ipa 文件名
        $file.move({
            src: this.kernel.getRawIPAPath(name),
            dst: FileStorage.join(this.kernel.getIPAPath(name), `${ipaName}.ipa`)
        })
        // 后改目录名
        $file.move({
            src: this.kernel.getIPAPath(name),
            dst: this.kernel.getIPAPath(ipaName)
        })
        this.updateList()
        loading.end()
    }

    updateList() {
        $(this.listId).data = this.getIPAs()
        $(this.listId).relayout()
    }

    getIPAs() {
        const ipas = $file.list("shared://ipa-installer")
        return ipas.map(name => {
            const plist = this.getPlist(name)
            return {
                name,
                icon: {
                    image: $image(FileStorage.join(this.kernel.getIPAContentPath(name), "iTunesArtwork"))
                },
                title: { text: plist.itemName },
                version: { text: `${plist.bundleShortVersionString} - ${plist.softwareVersionExternalIdentifier}` },
                artistName: { text: plist.artistName },
                appleId: {
                    hidden: !this.kernel.setting.get("general.showAppleID"),
                    text: "Apple ID: " + plist.appleId
                }
            }
        })
    }

    getTemplate() {
        return [
            {
                type: "image",
                props: {
                    id: "icon",
                    bgcolor: $color("clear"),
                    clipsToBounds: true,
                    cornerRadius: 10,
                    smoothCorners: true
                },
                layout: make => {
                    make.size.equalTo(this.iconSize)
                    make.left.inset(this.iconPadding)
                    make.top.inset(this.iconPadding)
                }
            },
            {
                type: "label",
                props: {
                    id: "title",
                    font: this.titleFont
                },
                layout: (make, view) => {
                    make.top.equalTo(view.prev)
                    make.left.equalTo(view.prev.right).offset(this.iconPadding)
                }
            },
            {
                type: "label",
                props: {
                    id: "version",
                    font: this.infoFont,
                    color: $color("systemGray2")
                },
                layout: (make, view) => {
                    make.left.equalTo(view.prev)
                    make.top.equalTo(view.prev.bottom)
                }
            },
            {
                type: "label",
                props: {
                    id: "artistName",
                    font: this.infoFont,
                    color: $color("systemGray2")
                },
                layout: (make, view) => {
                    make.left.equalTo(view.prev)
                    make.top.equalTo(view.prev.bottom)
                }
            },
            {
                type: "label",
                props: {
                    id: "appleId",
                    font: this.infoFont,
                    color: $color("systemGray2")
                },
                layout: (make, view) => {
                    make.left.equalTo(view.prev)
                    make.top.equalTo(view.prev.bottom)
                }
            }
        ]
    }

    installIPA(name) {
        if (!this.kernel.isReady) {
            $ui.alert({
                title: $l10n("NEED_TLS_CONFIG"),
                message: $l10n("SEE_README")
            })
            return
        }
        $nodejs.notify("install", { name })
        // name = $text.URLEncode(name)
        // $safari.open({
        //     url: `https://${this.kernel.tlsConfig.domain}:${this.kernel.tlsConfig.port}/${name}/html`
        // })
    }

    getListView() {
        return {
            type: "list",
            props: {
                id: this.listId,
                bgcolor: UIKit.primaryViewBackgroundColor,
                separatorInset: $insets(0, this.iconPadding * 2 + this.iconSize, 0, 0),
                data: this.getIPAs(),
                template: {
                    views: this.getTemplate()
                },
                actions: [
                    {
                        title: " " + $l10n("DELETE") + " ",
                        color: $color("red"),
                        handler: (sender, indexPath) => {
                            const data = sender.object(indexPath)
                            this.kernel.deleteConfirm(data.title.text, () => {
                                this.deleteIPA(data.name)
                                sender.delete(indexPath)
                            })
                        }
                    }
                ]
            },
            events: {
                rowHeight: () => {
                    if (!this.kernel.setting.get("general.showAppleID")) {
                        return this.iconPadding * 2 + this.iconSize
                    }

                    let height = this.iconPadding * 2 + this.titleFontSize.height
                    height += this.infoFontSize.height * 3

                    return height
                },
                pulled: sender => {
                    $(this.listId).data = this.getIPAs()
                    sender.endRefreshing()
                },
                didSelect: (sender, indexPath, data) => {
                    this.installIPA(data.name)
                }
            },
            layout: $layout.fill
        }
    }
}

module.exports = HomeUI
