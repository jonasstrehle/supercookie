import express from "express";
import path from "path";
import fs from "fs";
import cookieParser from "cookie-parser";
import crypto from "crypto";
const generateUUID = (pattern = `xxxx-xxxx-xxxx-xxxx-xxxx`, charset = "abcdefghijklmnopqrstuvwxyz0123456789") => pattern.replace(/[x]/g, () => charset[Math.floor(Math.random() * charset.length)]);
const hashNumber = (value) => crypto.createHash("MD5")
    .update(value.toString())
    .digest("hex").slice(-12).split(/(?=(?:..)*$)/)
    .join(' ').toUpperCase();
const createRoutes = (base, count) => {
    const array = [];
    for (let i = 0; i < count; i++)
        array.push(crypto.createHash("MD5").update(`${base}${i.toString()}`).digest("base64").replace(/(\=|\+|\/)/g, '0').substring(0, 22));
    return array;
};
class Storage {
    constructor() {
        this._path = path.join(path.resolve(), "data.json");
        this._content = {};
        if (!this.existsPersistent()) {
            this.createPersistent();
        }
        this.read();
    }
    get content() {
        return this._contentProxy;
    }
    set content(data) {
        this._content = data;
        const _this = this;
        const proxy = {
            get(target, key) {
                if (typeof target[key] === 'object' && target[key] !== null)
                    return new Proxy(target[key], proxy);
                else
                    return target[key];
            },
            set(target, key, value) {
                target[key] = value;
                _this.write(_this.content);
                return true;
            }
        };
        this._contentProxy = new Proxy(this._content, proxy);
        _this.write(_this.content);
    }
    read() {
        return this.content = JSON.parse(fs.readFileSync(this._path).toString() || "{}"), this;
    }
    write(content) {
        fs.writeFileSync(this._path, JSON.stringify(content, null, '\t'));
        return this;
    }
    createPersistent() {
        this.write({});
    }
    existsPersistent() {
        return fs.existsSync(this._path);
    }
}
const STORAGE = new Storage().content;
const WEBSERVER_PORT_1 = 10080;
const WEBSERVER_PORT_2 = 10081;
const CACHE_IDENTIFIER = STORAGE.cacheID ?? generateUUID("xxxxxxxx", "0123456789abcdef");
const N = 10;
const webserver_1 = express();
const webserver_2 = express();
const maxN = 2 ** N - 1;
let Webserver = (() => {
    class Webserver {
        static getVector(identifier) {
            const booleanVector = (identifier >>> 0).toString(2)
                .padStart(this.routes.length, '0').split('')
                .map((element) => element === '1');
            const vector = new Array();
            booleanVector.forEach((value, index) => value ? vector.push(this.getRouteByIndex(index)) : void 0);
            return vector;
        }
        static getIdentifier(vector) {
            return parseInt(this.routes.map((route) => vector.has(route) ? 1 : 0).join(''), 2);
        }
        static hasRoute(route) {
            return this.routes.includes(route);
        }
        static getRouteByIndex(index) {
            return this.routes[index] ?? null;
        }
        static getIndexByRoute(route) {
            return this.routes.indexOf(route) ?? null;
        }
        static getNextRoute(route) {
            const index = this.routes.indexOf(route);
            if (index === -1)
                throw "Route is not valid.";
            return this.getRouteByIndex(index + 1);
        }
        static setCookie(res, name, value, options = { httpOnly: false, expires: new Date(Date.now() + 60 * 1000) }) {
            return res.cookie(name, value, options), res;
        }
        static sendFile(res, route, options = {}, type = "html") {
            let content = fs.readFileSync(route).toString();
            Object.keys(options).sort((a, b) => b.length - a.length).forEach((key) => {
                content = content.replace(new RegExp(`\{\{${key}\}\}`, 'g'), (options[key]?.toString() || '')
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;"));
            });
            res.header({
                "Cache-Control": "private, no-cache, no-store, must-revalidate",
                "Expires": -1,
                "Pragma": "no-cache"
            });
            res.type(type);
            return res.send(content), res;
        }
    }
    Webserver.routes = createRoutes(CACHE_IDENTIFIER, N).map((value) => `${CACHE_IDENTIFIER}:${value}`);
    return Webserver;
})();
let Profile = (() => {
    class Profile {
        constructor(uid, identifier = null) {
            this._identifier = null;
            this._visitedRoutes = new Set();
            this._uid = uid;
            if (identifier !== null)
                this._identifier = identifier,
                    this._vector = Webserver.getVector(identifier);
            Profile.list.add(this);
        }
        static get(uid) {
            return this.has(uid) ?
                Array.from(this.list).filter((profile) => profile.uid === uid)?.pop() :
                null;
        }
        static has(uid) {
            return Array.from(this.list).some((profile) => profile.uid === uid);
        }
        static from(uid, identifier) {
            return !this.has(uid) ? new Profile(uid, identifier) : null;
        }
        destructor() {
            Profile.list.delete(this);
        }
        get uid() {
            return this._uid;
        }
        get vector() {
            return this._vector;
        }
        get identifier() {
            return this._identifier;
        }
        getRouteByIndex(index) {
            return this.vector[index] ?? null;
        }
        _isReading() {
            return this._identifier === null;
        }
        _visitRoute(route) {
            this._visitedRoutes.add(route);
        }
        _calcIdentifier() {
            return this._identifier = Webserver.getIdentifier(this._visitedRoutes), this.identifier;
        }
    }
    Profile.list = new Set();
    return Profile;
})();
webserver_2.set("trust proxy", 1);
webserver_2.use(cookieParser());
webserver_2.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.headers.origin);
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
webserver_2.get("/read", (_req, res) => {
    const uid = generateUUID();
    const profile = Profile.from(uid);
    if (profile === null)
        return res.redirect("/read");
    Webserver.setCookie(res, "uid", uid);
    res.redirect(`/t/${Webserver.getRouteByIndex(0)}`);
});
webserver_2.get("/write", (_req, res) => {
    const uid = generateUUID();
    const profile = Profile.from(uid, STORAGE.index);
    if (profile === null)
        return res.redirect("/write");
    STORAGE.index++;
    Webserver.setCookie(res, "uid", uid);
    res.redirect(`/t/${Webserver.getRouteByIndex(0)}`);
});
webserver_2.get("/t/:ref", (req, res) => {
    const referrer = req.params.ref;
    const uid = req.cookies.uid;
    const profile = Profile.get(uid);
    if (!Webserver.hasRoute(referrer) || profile === null)
        return res.redirect('/');
    const nextReferrer = Webserver.getNextRoute(referrer);
    Webserver.sendFile(res, path.join(path.resolve(), "www/referrer.html"), {
        referrer: nextReferrer ? `t/${nextReferrer}?x=${Math.random() * 10000}` : profile._isReading() ? "identity" : "",
        favicon: referrer,
        bit: !profile._isReading() ? profile.vector.includes(referrer) : false,
        index: `${Webserver.getIndexByRoute(referrer) + 1} / ${Webserver.routes.length}`
    });
});
webserver_2.get("/identity", (req, res) => {
    const uid = req.cookies.uid;
    const profile = Profile.get(uid);
    if (profile === null)
        return res.redirect('/');
    res.clearCookie("uid");
    res.clearCookie("vid");
    const identifier = profile._calcIdentifier();
    if (identifier === maxN)
        return res.redirect("/write");
    const identifierHash = hashNumber(identifier);
    Webserver.sendFile(res, path.join(path.resolve(), "www/identity.html"), {
        hash: identifierHash,
        identifier: identifier
    });
});
webserver_2.get(`/${CACHE_IDENTIFIER}`, (req, res) => {
    const rid = !!req.cookies.rid;
    res.clearCookie("rid");
    if (!rid)
        Webserver.sendFile(res, path.join(path.resolve(), "www/redirect.html"));
    else
        Webserver.sendFile(res, path.join(path.resolve(), "www/launch.html"), {
            favicon: CACHE_IDENTIFIER
        });
});
webserver_2.get('/', (_req, res) => {
    Webserver.setCookie(res, "rid", true);
    res.clearCookie("mid");
    res.redirect(`/${CACHE_IDENTIFIER}`);
});
webserver_2.get("/l/:ref", (_req, res) => {
    console.log("new visitor", Date.now());
    Webserver.setCookie(res, "mid", true, { expires: null });
    const data = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
    res.writeHead(200, {
        "Cache-Control": "public, max-age=31536000",
        "Expires": new Date(Date.now() + 31536000000).toUTCString(),
        "Content-Type": "image/png",
        "Content-Length": data.length
    });
    res.end(data);
});
webserver_2.get("/f/:ref", (req, res) => {
    const referrer = req.params.ref;
    const uid = req.cookies.uid;
    if (!Profile.has(uid) || !Webserver.hasRoute(referrer))
        return res.status(404), res.end();
    const profile = Profile.get(uid);
    if (profile._isReading()) {
        profile._visitRoute(referrer);
        console.log("Reading favicon", Webserver.getIndexByRoute(referrer));
        return res.type("gif"), res.status(404), res.end();
    }
    if (profile.vector.includes(referrer)) {
        console.log("writing", Webserver.getIndexByRoute(referrer));
        return;
    }
    const data = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
    res.writeHead(200, {
        "Cache-Control": "public, max-age=31536000",
        "Expires": new Date(Date.now() + 31536000000).toUTCString(),
        "Content-Type": "image/png",
        "Content-Length": data.length
    });
    res.end(data);
});
webserver_1.use(express.static(path.join(path.resolve(), "www"), { index: false, extensions: ["html"] }));
webserver_2.use(express.static(path.join(path.resolve(), "www"), { index: false, extensions: ["html"] }));
webserver_1.get('/', (_req, res) => {
    Webserver.sendFile(res, path.join(path.resolve(), "www/index.html"));
});
webserver_1.get("*", (_req, res) => {
    res.redirect('/');
});
webserver_2.get("*", (req, res) => {
    Webserver.sendFile(res, path.join(path.resolve(), "www/404.html"), {
        path: decodeURIComponent(req.path)
    });
});
webserver_1.listen(WEBSERVER_PORT_1, () => console.log(`express | Express webserver_1 running on port ${WEBSERVER_PORT_1}`));
webserver_2.listen(WEBSERVER_PORT_2, () => console.log(`express | Express webserver_2 running on port ${WEBSERVER_PORT_2}`));
STORAGE.index = STORAGE.index ?? 0;
STORAGE.cacheID = CACHE_IDENTIFIER;
