import express from "express";
import path from "path";
import fs from "fs";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";

/**
 * Creates UUID in the specified pattern's
 * form using charset
 * @param pattern 
 * @param charset 
 */
const generateUUID = (
    pattern: string = "xxxx-xxxx-xxxx-xxxx-xxxx", 
    charset: string = "abcdefghijklmnopqrstuvwxyz0123456789"): string =>
	pattern.replace(/[x]/g, () => charset[Math.floor(Math.random() * charset.length)]);

/**
 * Creates HEX-hash from number 
 * @param value
 */
const hashNumber = (value: number): string => crypto.createHash("MD5")
    .update(value.toString())
    .digest("hex").slice(-12).split(/(?=(?:..)*$)/)
    .join(' ').toUpperCase();

/**
 * Creates string-array with length "count"
 * from value "base"
 * @param base 
 * @param count 
 */
const createRoutes = (base: string, count: number): Array<string> => {
    const array = [];
    for (let i=0; i<count; i++)
        array.push(crypto.createHash("MD5")
            .update(`${base}${i.toString()}`).digest("base64")
            .replace(/(\=|\+|\/)/g, '0').substring(0, 22));
    return array;
}

/**
 * @class Storage
 * For writing and reading
 * persistent JSON on file-system
 */
class Storage {
    private _path: string = path.join(path.resolve(), "data.json");
    private _content: object = {};
    private _contentProxy: object;
    constructor() {
        if (!this.existsPersistent())
            this.createPersistent();
        this.read();
    }
    public get content(): any {
        return this._contentProxy;
    }
    public set content(data: any) {
        this._content = data;
        const _this = this;
        const proxy = {
            get(target: any, key: any) {
                if (typeof target[key] === 'object' && target[key] !== null) 
                    return new Proxy(target[key], proxy)
                else return target[key];
            },
            set (target: any, key: any, value: any): any {
                target[key] = value;
                _this.write(_this.content);
                return true;
            }
        }
        this._contentProxy = new Proxy(this._content, proxy);
        _this.write(_this.content);
    }
    private read(): Storage {
        return this.content = JSON.parse(fs.readFileSync(this._path).toString() || "{}"), this;
    }
    private write(content: object): Storage {
        fs.writeFileSync(this._path, JSON.stringify(content, null, '\t'));
        return this;
    }
    private createPersistent() {
        this.write({});
    }
    private existsPersistent() {
        return fs.existsSync(this._path);
    }
}
const STORAGE: any = new Storage().content;
dotenv.config();

/****************************************************************************************************\
 * @global
 * User options (edit in .env file)
 */
const WEBSERVER_DOMAIN_1: string    = process.env["HOST_MAIN"] ?? "localhost:10080";
const WEBSERVER_DOMAIN_2: string    = process.env["HOST_DEMO"] ?? "localhost:10081";
const WEBSERVER_PORT_1: number      = +process.env["PORT_MAIN"] ?? 10080;
const WEBSERVER_PORT_2: number      = +process.env["PORT_DEMO"] ?? 10081;
const CACHE_IDENTIFIER: string      = STORAGE.cacheID ?? generateUUID("xxxxxxxx", "0123456789abcdef");

const N: number                     = 32; // max 2^N unique ids possible
/*****************************************************************************************************/


const FILE = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
const webserver_1: express.Express = express();
const webserver_2: express.Express = express();
const maxN: number = 2**N - 1;

webserver_1.options('*', cors());
webserver_2.options('*', cors());

console.info(`supercookie | Starting up using N=${N}, C-ID='${CACHE_IDENTIFIER}' ...`);
console.info(`supercookie | There are ${Math.max(maxN - 1 - (STORAGE.index ?? 1), 0)}/${maxN-1} unique identifiers left.`);


/**
 * @class Webserver
 * Webserver defaults
 */
class Webserver {
    public static routes: Array<string> = createRoutes(CACHE_IDENTIFIER, N).map((value: string) => `${CACHE_IDENTIFIER}:${value}`);
    
    public static getVector(identifier: number): Array<string> {
        const booleanVector: Array<boolean> = (identifier >>> 0).toString(2)
            .padStart(this.routes.length, '0').split('')
            .map((element: '0' | '1') => element === '1')
            .reverse();
        const vector = new Array<string>();
        booleanVector.forEach((value: boolean, index: number) => value ? vector.push(this.getRouteByIndex(index)) : void 0);
        return vector;
    }
    public static getIdentifier(vector: Set<string>, size: number = vector.size): number {
        return parseInt(this.routes.map((route: string) => vector.has(route) ? 0 : 1)
            .join('').slice(0, size).split('').reverse().join(''), 2);
    }
    public static hasRoute(route: string): boolean {
        return this.routes.includes(route);
    }
    public static getRouteByIndex(index: number): string {
        return this.routes[index] ?? null;
    }
    public static getIndexByRoute(route: string): number {
        return this.routes.indexOf(route) ?? null;
    }
    public static getNextRoute(route: string): string | null {
        const index = this.routes.indexOf(route);
        if (index === -1)
            throw "Route is not valid.";
        return this.getRouteByIndex(index+1);
    }
    public static setCookie(res: express.Response,
                            name: string, value: any, 
                            options: express.CookieOptions = { httpOnly: false, expires: new Date(Date.now() + 60 * 1000) }): express.Response {
        return res.cookie(name, value, options), res;
    }
    public static sendFile( res: express.Response, 
                            route: string, options: any = {}, type: string = "html"): express.Response {
        let content = fs.readFileSync(route).toString();
        Object.keys(options).sort((a: string, b: string) => b.length - a.length).forEach((key: string) => {
            content = content.replace(
                new RegExp(`\{\{${key}\}\}`, 'g'), 
                (options[key]?.toString() || '')
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;")
            );
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

/**
 * @class Profile
 * Read / Write class
 */
class Profile {
    public static list: Set<Profile> = new Set<Profile>();
    public static get(uid: string): Profile {
        return this.has(uid) ? 
            Array.from(this.list).filter((profile: Profile) => profile.uid === uid)?.pop(): 
            null;
    }
    public static has(uid: string): boolean {
        return Array.from(this.list).some((profile: Profile) => profile.uid === uid);
    }
    public static from(uid: string, identifier?: number): Profile {
        return !this.has(uid) ? new Profile(uid, identifier): null;
    }

    private _uid: string;
    private _vector: Array<string>;
    private _identifier: number = null;
    private _visitedRoutes: Set<string> = new Set<string>();
    private _storageSize: number = -1;

    constructor(uid: string, identifier: number = null) {
        this._uid = uid;
        if (identifier !== null) 
            this._identifier = identifier,
            this._vector = Webserver.getVector(identifier);
        Profile.list.add(this);
    }
    public destructor() {
        Profile.list.delete(this);
    }
    public get uid(): string {
        return this._uid;
    }
    public get vector(): Array<string> {
        return this._vector;
    }
    public get visited(): Set<string> {
        return this._visitedRoutes;
    }
    public get identifier(): number {
        return this._identifier;
    }
    public getRouteByIndex(index: number): string {
        return this.vector[index] ?? null;
    }
    public _isReading(): boolean {
        return this._identifier === null;
    }
    public _visitRoute(route: string) {
        this._visitedRoutes.add(route);
    }
    public _calcIdentifier(): number {
        return this._identifier = Webserver.getIdentifier(this._visitedRoutes, this._storageSize), this.identifier;
    }
    public _setStorageSize(size: number) {
        this._storageSize = size;
    }
    public get storageSize(): number {
        return this._storageSize;
    }
};

webserver_2.set("trust proxy", 1);
webserver_2.use(cookieParser());
webserver_2.use((req: express.Request, res: express.Response, next: Function) => {  
    if (new RegExp(`https?:\/\/${WEBSERVER_DOMAIN_2}`).test(req.headers.origin))
        res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    return next();
});


/**
 * @description
 * Using token based "write authentification" to avoid spam to /write path
 */
const midSet: Set<string> = new Set<string>();
const generateWriteToken = (): string => {
    const uuid = generateUUID();
    setTimeout(() => midSet.delete(uuid), 1_000 * 60);
    return midSet.add(uuid), uuid;
}
const deleteWriteToken = (token: string) => midSet.delete(token);
const hasWriteToken = (token: string): boolean => midSet.has(token);

/**
 * @description
 * When navigating to path /read the mode of an (known) visitor is set to "write". 
 * Assuming that the data has already been written to the browser, the webserver
 * is redirecting the user to the first route.
 */
webserver_2.get("/read", (_req: express.Request, res: express.Response) => {
    const uid = generateUUID();
    console.info(`supercookie | Visitor uid='${uid}' is known • Read`);
    const profile: Profile = Profile.from(uid);
    profile._setStorageSize(Math.floor(Math.log2(STORAGE.index ?? 1)) + 1);
    if (profile === null)
        return res.redirect("/read");
    Webserver.setCookie(res, "uid", uid);
    res.redirect(`/t/${Webserver.getRouteByIndex(0)}?f=${generateUUID()}`)
});

/**
 * @description
 * If a user navigates to path /write a new (unknown) visitor entry is created.
 * Assuming that the data has not been written to the browser, the webserver
 * is redirecting the user to the first route.
 */
webserver_2.get("/write/:mid", (req: express.Request, res: express.Response) => {
    const mid = req.params.mid;
    if (!hasWriteToken(mid))
        return res.redirect('/');
    res.clearCookie("mid");
    deleteWriteToken(mid);
    const uid = generateUUID();
    console.info(`supercookie | Visitor uid='${uid}' is unknown • Write`, STORAGE.index);
    const profile: Profile = Profile.from(uid, STORAGE.index);
    if (profile === null)
        return res.redirect('/');
    STORAGE.index++;
    Webserver.setCookie(res, "uid", uid);
    res.redirect(`/t/${Webserver.getRouteByIndex(0)}`);
});

/**
 * @description
 * Under the /t path, the user is redirected to the next possible route.
 */
webserver_2.get("/t/:ref", (req: express.Request, res: express.Response) => {
    const referrer: string = req.params.ref;
    const uid: string = req.cookies.uid;
    const profile: Profile = Profile.get(uid);

    if (!Webserver.hasRoute(referrer) || profile === null)
        return res.redirect('/');
    const route: string = Webserver.getNextRoute(referrer);

    /** reload issue */
    if (profile._isReading() && profile.visited.has(referrer))
        return res.redirect('/');
    let nextReferrer: string = null;
    const redirectCount: number = profile._isReading() ? 
        profile.storageSize: 
        Math.floor(Math.log2(profile.identifier)) + 1;

    if (route) 
        nextReferrer = `t/${route}?f=${generateUUID()}`;
    if (!profile._isReading()) {
        if (Webserver.getIndexByRoute(referrer) >= redirectCount - 1)
            nextReferrer = "read";
    } else if (Webserver.getIndexByRoute(referrer) >= redirectCount - 1 || nextReferrer === null)
        nextReferrer = "identity";

    const bit = !profile._isReading() ? profile.vector.includes(referrer) : "{}";
    Webserver.sendFile(res, path.join(path.resolve(), "www/referrer.html"), {
        delay: profile._isReading() ? 500 : 800,
        referrer: nextReferrer,
        favicon: referrer,
        bit: bit,
        index: `${Webserver.getIndexByRoute(referrer)+1} / ${redirectCount}`
    });
});

/**
 * @description
 * After finishing the reading process, the browser is redirected to the /identity route. 
 * Here, the browser is assigned the calculated identifier and displayed to the user.
 */
webserver_2.get("/identity", (req: express.Request, res: express.Response) => {
    const uid: string = req.cookies.uid;
    const profile: Profile = Profile.get(uid);
    if (profile === null)
        return res.redirect('/');
    res.clearCookie("uid");
    res.clearCookie("vid");
    const identifier = profile._calcIdentifier();
    if (identifier === maxN || profile.visited.size === 0 || identifier === 0)
        return res.redirect(`/write/${generateWriteToken()}`);
    if (identifier !== 0) {
        const identifierHash: string = hashNumber(identifier);
        console.info(`supercookie | Visitor successfully identified as '${identifierHash}' • (#${identifier}).`);
        Webserver.sendFile(res, path.join(path.resolve(), "www/identity.html"), {
            hash: identifierHash,
            identifier: `#${identifier}`,

            url_workwise: `${WEBSERVER_DOMAIN_1}/workwise`,
            url_main: WEBSERVER_DOMAIN_1
        });
    } else Webserver.sendFile(res, path.join(path.resolve(), "www/identity.html"), {
        hash: "AN ON YM US",
        identifier: "browser not vulnerable",

        url_workwise: `${WEBSERVER_DOMAIN_1}/workwise`,
        url_main: WEBSERVER_DOMAIN_1
    });
});

/**
 * @description
 * Fixing a chrome (v 87.0) problem using javascript redirect instead of 
 * express redirect (in redirect.html)
 */
webserver_2.get(`/${CACHE_IDENTIFIER}`, (req: express.Request, res: express.Response) => {
    const rid: boolean = !!req.cookies.rid;
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

/**
 * @description
 * Main route / is redirecting to /CACHE_IDENTIFIER
 */
webserver_2.get('/', (_req: express.Request, res: express.Response) => {
    Webserver.setCookie(res, "rid", true);
    res.clearCookie("mid");
    res.redirect(`/${CACHE_IDENTIFIER}`);
});

/**
 * @description
 * When requesting the favicon under /l, it is excluded that a user already has valid data in the cache.
 */
webserver_2.get("/l/:ref", (_req: express.Request, res: express.Response) => {
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


webserver_2.get("/i/:ref", (req: express.Request, res: express.Response) => {
    const data = Buffer.from(FILE, "base64");
    res.writeHead(200, {
        "Cache-Control": "public, max-age=31536000",
        "Expires": new Date(Date.now() + 31536000000).toUTCString(),
        "Content-Type": "image/png",
        "Content-Length": data.length
    });
    res.end(data);
});
/**
 * @description
 * /f route handles requests for favicons by the browser.
 * In write mode, some icons are delivered and other requests are aborted. 
 * In read mode every request fails to not corrupt the cache.
 */
webserver_2.get("/f/:ref", (req: express.Request, res: express.Response) => {
    const referrer: string = req.params.ref;
    const uid: string = req.cookies.uid;
    if (!Profile.has(uid) || !Webserver.hasRoute(referrer))
        return res.status(404), res.end();
    const profile: Profile = Profile.get(uid);
    if (profile._isReading()) {
        profile._visitRoute(referrer);
        console.info(`supercookie | Favicon requested by uid='${uid}' • Read `, Webserver.getIndexByRoute(referrer), "•", 
            Array.from(profile.visited).map(route => Webserver.getIndexByRoute(route)));
        return; // res.type("gif"), res.status(404), res.end();
    }
    if (!profile.vector.includes(referrer)) {
        console.info(`supercookie | Favicon requested by uid='${uid}' • Write`, Webserver.getIndexByRoute(referrer), "•", 
            Array.from(profile.vector).map(route => Webserver.getIndexByRoute(route)));
        return; // res.type("gif"), res.status(404), res.end();
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
webserver_1.get('/', (_req: express.Request, res: express.Response) => {
    Webserver.sendFile(res, path.join(path.resolve(), "www/index.html"), {
        url_demo: WEBSERVER_DOMAIN_2
    });
});
webserver_1.get("/favicon.ico", (_req: express.Request, res: express.Response) => {
    res.sendFile(path.join(path.resolve(), "www/favicon.ico"));
});
webserver_2.get("/favicon.ico", (_req: express.Request, res: express.Response) => {
    res.sendFile(path.join(path.resolve(), "www/favicon.ico"));
});
webserver_1.get("/workwise", (_req: express.Request, res: express.Response) => {
    Webserver.sendFile(res, path.join(path.resolve(), "www/workwise.html"), {
        url_main: WEBSERVER_DOMAIN_1
    });
});
webserver_1.get("/api", (_req: express.Request, res: express.Response) => {
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
webserver_1.get('*', (_req: express.Request, res: express.Response) => {
    res.redirect('/');
});
webserver_2.get('*', (req: express.Request, res: express.Response) => {
    Webserver.sendFile(res, path.join(path.resolve(), "www/404.html"), {
        path: decodeURIComponent(req.path),
        url_main: WEBSERVER_DOMAIN_1
    });
});

webserver_1.listen(WEBSERVER_PORT_1, () => 
    console.info(`express-web | Webserver-1 for '${WEBSERVER_DOMAIN_1}' running on port:`, WEBSERVER_PORT_1));
webserver_2.listen(WEBSERVER_PORT_2, () => 
    console.info(`express-web | Webserver-2 for '${WEBSERVER_DOMAIN_2}' running on port:`, WEBSERVER_PORT_2));
STORAGE.index = STORAGE.index ?? 1;
STORAGE.cacheID = CACHE_IDENTIFIER;