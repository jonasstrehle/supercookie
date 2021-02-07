<p align="center">
  <a href="https://supercookie.me">
    <img src="http://supercookie.me/favicon.ico" alt="supercookie" width="100px" />
  </a>
</p>
<p align="center">
  <a href="https://github.com/jonasstrehle/supercookie">
    <img src="https://img.shields.io/github/languages/count/jonasstrehle/supercookie" alt="Languages used">
  </a>
</p>
<p align="center">
  <a href="https://supercookie.me">
    <img src="https://img.shields.io/website?down_message=down&up_color=green&up_message=online&url=https%3A%2F%2Fsupercookie.me" alt="Website Status">
  </a>
  <a href="https://github.com/jonasstrehle/supercookie">
    <img src="https://img.shields.io/github/license/jonasstrehle/supercookie" alt="License">
  </a>
</p>


**Supercookie** uses favicons to assign a unique identifier to website visitors.<br>
Unlike traditional tracking methods, this ID can be stored almost persistently and cannot be easily cleared by the user.

The tracking method works even in the browser's incognito mode and is not cleared by flushing the cache, closing the browser or restarting the system, using a VPN or installing AdBlockers. 🍿 [Live demo](https://supercookie.me).

## About

### 💭 Inspiration

- Paper by Scientists at University of Illinois, Chicago: [www.cs.uic.edu](https://www.cs.uic.edu/~polakis/papers/solomos-ndss21.pdf)
- Article by heise: [heise.de](https://heise.de/-5027814) 

### 🪧 Purpose

This repository is for **educational** and **demonstration purposes** only!

The demo of "supercookie" as well as the publication of the source code of this repository is intended to draw attention to the problem of tracking possibilities using favicons.

📕 [Full documentation](https://supercookie.me/workwise)

## Installation

### 🔧 Docker
**requirements**: 
<img src="https://docs.docker.com/favicon.ico" width="12px"> [Docker daemon](https://docs.docker.com/get-docker/)

1. Clone repository
```bash
git clone https://github.com/jonasstrehle/supercookie
```

2. Update .env file in [supercookie/server/.env](https://github.com/jonasstrehle/supercookie/blob/main/server/.env)
```env
HOST_MAIN=yourdomain.com #or localhost:10080
PORT_MAIN=10080

HOST_DEMO=demo.yourdomain.com #or localhost:10081
PORT_DEMO=10081
```

3. Run container
```bash
cd supercookie/server
docker-compose up
```

-> Webserver will be running at https://yourdomain.com



### 🤖 Local machine
**requirements**: 
<img src="https://nodejs.org/static/images/favicons/favicon.ico" width="12px"> [Node.js](https://nodejs.org/)

1. Clone repository
```bash
git clone https://github.com/jonasstrehle/supercookie
```

2. Update .env file in [supercookie/server/.env](https://github.com/jonasstrehle/supercookie/blob/main/server/.env)
```env
HOST_MAIN=localhost:10080
PORT_MAIN=10080

HOST_DEMO=localhost:10081
PORT_DEMO=10081
```

3. Run service
```bash
cd supercookie/server
node main.js
```

-> Webserver will be running at http://localhost:10080


## Workwise of [supercookie](https://supercookie.me/workwise)


### [📖 Background](https://supercookie.me/workwise#content-background)

Modern browsers offer a wide range of features to improve and simplify the user experience.
One of these features are the so-called favicons: A favicon is a small (usually 16×16 or 32×32 pixels) logo used by web browsers to brand a website in a recognizable way. Favicons are usually shown by most browsers in the address bar and next to the page's name in a list of bookmarks.

To serve a favicon on their website, a developer has to include an <link rel> attribute in the webpage’s header. If this tag does exist, the browser requests the icon from the predefined source and if the server response contains an valid icon file that can be properly rendered this icon is displayed by the browser. In any other case, a blank favicon is shown.

```html
<link rel="icon" href="/favicon.ico" type="image/x-icon">
```

The favicons must be made very easily accessible by the browser. Therefore, they are cached in a separate local database on the system, called the favicon cache (F-Cache). A F-Cache data entries includes the visited URL (subdomain, domain, route, URL paramter), the favicon ID and the time to live (TTL).
While this provides web developers the ability to delineate parts of their website using a wide variety of icons for individual routes and subdomains, it also leads to a possible tracking scenario.

When a user visits a website, the browser checks if a favicon is needed by looking up the source of the shortcut icon link reference of the requested webpage.
The browser initialy checks the local F-cache for an entry containing the URL of the active website. If a favicon entry exists, the icon will be loaded from the cache and then displayed. However, if there is no entry, for example because no favicon has ever been loaded under this particular domain, or the data in the cache is out of date, the browser makes a GET request to the server to load the site's favicon.


### [💣 Threat Model](https://supercookie.me/workwise#content-threat-model)

In the article a possible threat model is explained that allows to assign a unique identifier to each browser in order to draw conclusions about the user and to be able to identify this user even in case of applied anti-fingerprint measures, such as the use of a VPN, deletion of cookies, deletion of the browser cache or manipulation of the client header information.

A web server can draw conclusions about whether a browser has already loaded a favicon or not:
So when the browser requests a web page, if the favicon is not in the local F-cache, another request for the favicon is made. If the icon already exists in the F-Cache, no further request is sent.
By combining the state of delivered and not delivered favicons for specific URL paths for a browser, a unique pattern (identification number) can be assigned to the client.
When the website is reloaded, the web server can reconstruct the identification number with the network requests sent by the client for the missing favicons and thus identify the browser.




<p align="center">
  <a href="https://supercookie.me">
    <img src="https://supercookie.me/assets/header.png" alt="Supercookie Header" width="600px" />
  </a>
</p>

<table>
  <thead>
    <tr>
      <th></th>
      <th align="center"><img width="350" height="0"> <p>conventional cookies</p></th>
      <th align="center"><img width="350" height="0"> <p>supercookie</p></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Identification accuracy</td>
      <td align="center">-</td>
      <td align="center">100%</td>
    </tr>
    <tr>
      <td>Incognito / Private mode detection</td>
      <td align="center">❌</td>
      <td align="center">✅</td>
    </tr>
    <tr>
      <td>Persistent after flushed website cache and cookies</td>
      <td align="center">❌</td>
      <td align="center">✅</td>
    </tr>
    <tr>
      <td>Identify multiple windows</td>
      <td align="center">❌</td>
      <td align="center">✅</td>
    </tr>
    <tr>
      <td>Working with Anti-Tracking SW</td>
      <td align="center">❌</td>
      <td align="center">✅</td>
    </tr>
  </tbody>
</table>


### [🎯 Target](https://supercookie.me/workwise#content-target)

It looks like all top browsers (<img src="https://www.google.com/favicon.ico" width="12px"> [Chrome](https://google.com/chrome/), <img src="https://www.mozilla.org/favicon.ico" width="12px"> [Firefox](https://www.mozilla.org/en-US/firefox/new/), <img src="https://www.apple.com/favicon.ico" width="12px"> [Safari](https://www.apple.com/safari/), <img src="https://www.microsoft.com/favicon.ico" width="12px"> [Edge](https://www.microsoft.com/edge/)) are vulnerable to this attack scenario.<br>
Mobile browsers are also affected.

#### Current versions

<table>
  <thead>
    <tr>
      <th align="center"><p>Browser</p></th>
      <th align="center"><p>Windows</p></th>
      <th align="center"><p>MacOS</p></th>
      <th align="center"><p>Linux</p></th>
      <th align="center"><p>iOS</p></th>
      <th align="center"><p>Android</p></th>
      <th align="center"><i>Info</i></th>
    </tr>
  </thead>
  <tbody>
    <tr>
        <td>Chrome <em>(v 87.0)</em></td>
        <td align="center">✅</td>
        <td align="center">✅</td>
        <td align="center">✅</td>
        <td align="center">✅</td>
        <td align="center">✅</td>
        <td align="center"></td>
    </tr>
    <tr>
        <td>Safari <em>(v 14.0)</em></td>
        <td align="center">-</td>
        <td align="center">✅</td>
        <td align="center">-</td>
        <td align="center">✅</td>
        <td align="center">-</td>
        <td align="center"></td>
    </tr>
    <tr>
        <td>Edge <em>(v 87.0)</em></td>
        <td align="center">✅</td>
        <td align="center">✅</td>
        <td align="center">❌</td>
        <td align="center">❌</td>
        <td align="center">✅</td>
        <td align="center"></td>
    </tr>
    <tr>
        <td>Firefox <em>(v 85.0)</em></td>
        <td align="center">✅</td>
        <td align="center">✅</td>
        <td align="center">❌</td>
        <td align="center">❌</td>
        <td align="center">❌</td>
        <td>Fingerprint different in incognito mode</td>
    </tr>
    <tr>
        <td>Brave <em>(v 1.19.92)</em></td>
        <td align="center">❌</td>
        <td align="center">❌</td>
        <td align="center">❌</td>
        <td align="center">❔</td>
        <td align="center">❔</td>
        <td align="center"></td>
    </tr>
  </tbody>
</table>


#### Previous versions

<table>
  <thead>
    <tr>
      <th align="center"><p>Browser</p></th>
      <th align="center"><p>Windows</p></th>
      <th align="center"><p>MacOS</p></th>
      <th align="center"><p>Linux</p></th>
      <th align="center"><p>iOS</p></th>
      <th align="center"><p>Android</p></th>
      <th align="center"><i>Info</i></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>Brave</b> (v 1.14.0)</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">-</td>
    </tr>
    <tr>
      <td><b>Firefox</b> (&lt; v 84.0)</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">❔</td>
      <td align="center">❌</td>
      <td align="center">✅</td>
      <td align="center">-</td>
    </tr>
  </tbody>
</table>


### [⚙ Scalability & Performance](https://supercookie.me/workwise#content-scalability-performance)

By varying the number of bits that corresponds to the number of redirects to subpaths, this attack can be scaled almost arbitrarily.
It can distinguish 2^N unique users, where N is the number of redirects on the client side.
The time taken for the read and write operation increases as the number of distinguishable clients does.
<br>
In order to keep the number of redirects as minimal as possible, N can have a dynamic length. 
More about this [here](https://supercookie.me/workwise#content-scalability-performance).

## Other

### [🙎‍♂️ About me](https://jonas.strehles.info)

I am a twenty year old student from 🇩🇪 Germany. I like to work in software design and development and have an interest in the IT security domain.

This repository, including the setup of a demonstration portal, was created within two days as part of a private research project on the topic of "Tracking on the Web".


### [💖 Support the project](https://ko-fi.com/jonasstrehle)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/jonasstrehle)

## Spread the world!

Liked the project? Just give it a star ⭐ and spread the world!



