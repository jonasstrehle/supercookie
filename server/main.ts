import express from "express";
import path from "path";
import fs from "fs";
import cookieParser from "cookie-parser";
import crypto from "crypto";


/**
 * UTILS
 */
const generateUUID = (
    pattern: string = `xxxx-xxxx-xxxx-xxxx-xxxx`, 
    charset: string = "abcdefghijklmnopqrstuvwxyz0123456789"): string =>
	pattern.replace(/[x]/g, () => charset[Math.floor(Math.random() * charset.length)]);

const hashNumber = (value: number): string => crypto.createHash("MD5")
    .update(value.toString())
    .digest("hex").slice(-12).split(/(?=(?:..)*$)/)
    .join(' ').toUpperCase();

const createRoutes = (base: string, count: number): Array<string> => {
    const array = [];
    for (let i=0; i<count; i++)
        array.push(crypto.createHash("MD5").update(`${base}${i.toString()}`).digest("base64").replace(/(\=|\+|\/)/g, '0').substring(0, 22));
    return array;
}

class Storage {
    private _path: string = path.join(path.resolve(), "data.json");
    private _content: object = {};
    private _contentProxy: object;

    constructor() {
        if (!this.existsPersistent()) {
            this.createPersistent();
        }
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

/**
 * configurable options
 */
const WEBSERVER_PORT_1: number = 10080;
const WEBSERVER_PORT_2: number = 10081;
const CACHE_IDENTIFIER: string = STORAGE.cacheID ?? generateUUID("xxxxxxxx", "0123456789abcdef");
const N: number = 10;

const webserver_1: express.Express = express();
const webserver_2: express.Express = express();
const maxN: number = 2**N - 1;

/**
 * Webserver Class
 */
class Webserver {
    public static routes: Array<string> = createRoutes(CACHE_IDENTIFIER, N).map((value: string) => `${CACHE_IDENTIFIER}:${value}`);
    
    public static getVector(identifier: number): Array<string> {
        const booleanVector: Array<boolean> = (identifier >>> 0).toString(2)
            .padStart(this.routes.length, '0').split('')
            .map((element: '0' | '1') => element === '1');
        const vector = new Array<string>();
        booleanVector.forEach((value: boolean, index: number) => value ? vector.push(this.getRouteByIndex(index)) : void 0);
        return vector;
    }
    public static getIdentifier(vector: Set<string>): number {
        return parseInt(this.routes.map((route: string) => vector.has(route) ? 1 : 0).join(''), 2);
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
 * Profile Class
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
        return this._identifier = Webserver.getIdentifier(this._visitedRoutes), this.identifier;
    }
}

/**
 * Webserver setup
 */
webserver_2.set("trust proxy", 1);
webserver_2.use(cookieParser());
webserver_2.use((req: express.Request, res: express.Response, next: Function) => {  
    res.header("Access-Control-Allow-Origin", req.headers.origin);
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

webserver_2.get("/read", (_req: express.Request, res: express.Response) => {
    const uid = generateUUID();
    const profile: Profile = Profile.from(uid);
    if (profile === null)
        return res.redirect("/read");
    Webserver.setCookie(res, "uid", uid);
    res.redirect(`/t/${Webserver.getRouteByIndex(0)}`);
});

webserver_2.get("/write", (_req: express.Request, res: express.Response) => {
    const uid = generateUUID();
    const profile: Profile = Profile.from(uid, STORAGE.index);
    if (profile === null)
        return res.redirect("/write");
    STORAGE.index++;
    Webserver.setCookie(res, "uid", uid);
    res.redirect(`/t/${Webserver.getRouteByIndex(0)}`);
});

webserver_2.get("/t/:ref", (req: express.Request, res: express.Response) => {
    const referrer: string = req.params.ref;
    const uid: string = req.cookies.uid;
    const profile: Profile = Profile.get(uid);

    if (!Webserver.hasRoute(referrer) || profile === null)
        return res.redirect('/');
    const nextReferrer: string = Webserver.getNextRoute(referrer);

    Webserver.sendFile(res, path.join(path.resolve(), "www/referrer.html"), {
        referrer: nextReferrer ? `t/${nextReferrer}?x=${Math.random()*10000}` : profile._isReading() ? "identity" : "",
        favicon: referrer,
        bit: !profile._isReading() ? profile.vector.includes(referrer) : false,
        index: `${Webserver.getIndexByRoute(referrer)+1} / ${Webserver.routes.length}`
    });
});

webserver_2.get("/identity", (req: express.Request, res: express.Response) => {
    const uid: string = req.cookies.uid;
    const profile: Profile = Profile.get(uid);
    if (profile === null)
        return res.redirect('/');
    res.clearCookie("uid");
    res.clearCookie("vid");
    const identifier = profile._calcIdentifier();
    if (identifier === maxN)
        return res.redirect("/write");
    const identifierHash: string = hashNumber(identifier);
    Webserver.sendFile(res, path.join(path.resolve(), "www/identity.html"), {
        hash: identifierHash,
        identifier: identifier
    });
});

webserver_2.get(`/${CACHE_IDENTIFIER}`, (req: express.Request, res: express.Response) => {
    const rid: boolean = !!req.cookies.rid;
    res.clearCookie("rid");
    if (!rid) 
        Webserver.sendFile(res, path.join(path.resolve(), "www/redirect.html"));
    else
        Webserver.sendFile(res, path.join(path.resolve(), "www/index.html"), {
            favicon: CACHE_IDENTIFIER
        });
});

webserver_2.get('/', (_req: express.Request, res: express.Response) => {
    Webserver.setCookie(res, "rid", true);
    res.clearCookie("mid");
    res.redirect(`/${CACHE_IDENTIFIER}`);
});

webserver_2.get("/l/:ref", (_req: express.Request, res: express.Response) => {
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

webserver_2.get("/f/:ref", (req: express.Request, res: express.Response) => {
    const referrer: string = req.params.ref;
    const uid: string = req.cookies.uid;
    if (!Profile.has(uid) || !Webserver.hasRoute(referrer))
        return res.status(404), res.end();
    const profile: Profile = Profile.get(uid);
    if (profile._isReading()) {
        profile._visitRoute(referrer);
        console.log("Reading favicon", Webserver.getIndexByRoute(referrer))
        return res.type("gif"), res.status(404), res.end();
    }
    if (profile.vector.includes(referrer)) {
        console.log("writing", Webserver.getIndexByRoute(referrer))
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
webserver_1.get("*", (req: express.Request, res: express.Response) => {
    Webserver.sendFile(res, path.join(path.resolve(), "www/404.html"), {
        path: decodeURIComponent(req.path)
    });
});
webserver_2.get("*", (req: express.Request, res: express.Response) => {
    Webserver.sendFile(res, path.join(path.resolve(), "www/404.html"), {
        path: decodeURIComponent(req.path)
    });
});
webserver_1.listen(WEBSERVER_PORT_1, () => console.log(`express | Express webserver_1 running on port ${WEBSERVER_PORT_1}`));
webserver_2.listen(WEBSERVER_PORT_2, () => console.log(`express | Express webserver_2 running on port ${WEBSERVER_PORT_2}`));

STORAGE.index = STORAGE.index ?? 0;
STORAGE.cacheID = CACHE_IDENTIFIER;
