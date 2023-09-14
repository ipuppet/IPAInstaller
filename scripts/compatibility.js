/**
 * @typedef {import("./app").AppKernel} AppKernel
 */

class Compatibility {
    files = []

    /**
     * @param {AppKernel} kernel
     */
    constructor(kernel) {
        this.kernel = kernel
    }

    deleteFiles(files) {
        files.forEach(file => {
            if (!this.files.includes(file)) {
                this.files.push(file)
            }
        })
    }

    #deleteFiles() {
        this.files.forEach(file => {
            if ($file.exists(file)) {
                this.kernel.logger.info(`delete file: ${file}`)
                $file.delete(file)
            }
        })
    }

    async do() {
        this.#deleteFiles()
    }
}

class VersionActions {
    version = 1
    userVersion = $cache.get("compatibility.version") ?? 0

    /**
     * @param {AppKernel} kernel
     */
    constructor(kernel) {
        this.kernel = kernel
        this.compatibility = new Compatibility(this.kernel)
    }

    do() {
        // this.userVersion === 0 视为新用户
        if (($file.list("storage") || this.userVersion > 0) && this.userVersion < this.version) {
            this.kernel.logger.info(`compatibility: userVersion [${this.userVersion}] lower than [${this.version}]`)
            for (let i = this.userVersion + 1; i <= this.version; i++) {
                this.call(i)
            }
            this.compatibility.do().catch(e => this.kernel.logger.error(e))
        }

        // 修改版本
        $cache.set("compatibility.version", this.version)
    }

    call(version) {
        if (typeof this[`ver${version}`] === "function") {
            this[`ver${version}`]()
        } else {
            throw new ReferenceError(`Version ${version} undefined`)
        }
    }

    ver1() {
        console.log($file.list("shared://ipa-installer"))
        $file.list("shared://ipa-installer").forEach(ipa => {
            if (!$file.exists(`shared://ipa-installer/${ipa}/Content`)) return
            $file.move({
                src: `shared://ipa-installer/${ipa}`,
                dst: `shared://ipa-installer/ipas/${ipa}`
            })
        })

        if ($file.exists("storage/setting.json")) {
            $file.move({
                src: "storage/setting.json",
                dst: "shared://ipa-installer/setting.json"
            })
        }

        this.compatibility.deleteFiles(["storage"])
    }
}

/**
 * @param {AppKernel} kernel
 */
async function compatibility(kernel) {
    if (!kernel) return

    try {
        const versionActions = new VersionActions(kernel)
        versionActions.do()
    } catch (error) {
        kernel.logger.error(error)
        throw error
    }
}

module.exports = compatibility
