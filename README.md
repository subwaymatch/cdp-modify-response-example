# Modifying Response Headers to Force File Downloads in Puppeteer & Playwright

This repo contains examples of intercepting HTTP responses in both Puppeteer & Playwright.

## What these examples do:

1. :wrench: Creates a new Chrome-Devtools-Protocol (CDP) session in [Puppeteer](https://pptr.dev) or [Playwright](https://playwright.dev).
2. :hammer: Enable `Fetch` domain to let us substitute browser's network layer with our own code.
3. :eyes: Pause every page response and check its `content-type` header to match `pdf` and `xml` types.
4. :fast_forward: If the `content-type` is not what we are looking for, resume the request without any change.
5. :dart: If the `content-type` is what we're looking for (`pdf` or `xml`), add a `content-disposition: attachment` response header to make the browser download the file instead of opening it in Chromium's built-in viewers.

<br /><br />
**A visual overview**
<p align="center">
 <img src="https://user-images.githubusercontent.com/1064036/89210995-b5c2d500-d586-11ea-8bca-4b27231471c4.png" alt="cdp-modify-response-header" />
</p>

## But why?

Puppeteer's request interception can continue, abort, or answer a request with a response you build yourself, but it can't modify the response that actually comes back from the server. The CDP `Fetch` domain can. There may be multiple scenarios where you need to modify either the response body or response headers for crawling or testing. As an example, you may want Chromium to download PDF and XML content-type responses instead of opening them in the built-in viewers.

This is still how Chrome behaves, including in headless mode. Without the examples' interception (tested with Chrome 155):

| Browser mode | PDF | XML |
| --- | --- | --- |
| Headful | Opened in the PDF viewer | Rendered in the XML viewer |
| Headless (Puppeteer's default `headless: true`) | Opened in the PDF viewer | Rendered in the XML viewer |
| [`chrome-headless-shell`](https://developer.chrome.com/blog/chrome-headless-shell) (Puppeteer's `headless: 'shell'`, Playwright's default headless Chromium) | Downloaded | Rendered in the XML viewer |

Playwright has since added a built-in way to do this; see [Playwright's built-in alternative](#playwrights-built-in-alternative) below.

### Default Behaviors
<p align="center">
 <img src="https://user-images.githubusercontent.com/1064036/89196451-d7649200-d56f-11ea-9dca-3a22d7d9ff50.png" width="600" alt="chromium-pdf-viewer" />
 <br />
 PDF response (content-type: application/pdf) is opened in Chromium
</p>
<br /><br />
<p align="center">
 <img src="https://user-images.githubusercontent.com/1064036/89196461-db90af80-d56f-11ea-8640-44d4fff46574.png" width="600" alt="chromium-xml-viewer" />
 <br />
 XML response (content-type: text/xml) is also rendered in Chromium
</p>

### What We Want
![download](https://user-images.githubusercontent.com/1064036/89196952-95881b80-d570-11ea-8f8c-67fda573c768.png)
<br />
Make Chromium download the files. This can be done by adding a `content-disposition: attachment` header to the response.

### Site that contains dummy PDF and XML files

I've setup a test site with links to both the PDF file and XML file.<br />
[https://pdf-xml-download-test.vercel.app/](https://pdf-xml-download-test.vercel.app/)

<p align="center">
<img src="https://user-images.githubusercontent.com/1064036/89196464-ddf30980-d56f-11ea-95e2-3f6577719924.png" width="600" alt="pdf-xml-download-site" />
</p>


## Usage

### Requirements

- [Node.js](https://nodejs.org) 22.12 or later

### Install Dependencies
```bash
$ npm install
```

Puppeteer downloads its own Chrome during `npm install`. Playwright needs its Chromium installed separately:
```bash
$ npx playwright install chromium
```

### Run
Depending on whether you want to use Puppeteer or Playwright, run one of the following commands.
```bash
$ npm run puppeteer
```

```bash
$ npm run playwright
```

A browser window opens the test site. Click the PDF and XML links, and the files are saved to the `downloads` folder instead of being opened in the browser. Close the browser window to exit.

## Notes

- Codes for [Puppeteer](https://pptr.dev) and [Playwright](https://playwright.dev) are almost identical. They have subtle differences in creating a new CDP session and in saving downloads (Playwright deletes downloaded files when the browser closes, so the Playwright example copies them with `download.saveAs()`), but all other code are pretty much the same.
- Chromium is the only browser that will work with this example. Using Firefox or Webkit browsers will throw errors since they don't support CDP.
- `Fetch.enable` only pauses `Document` requests (pages and frames) at the `Response` stage, so images, scripts, and stylesheets load without a round trip through Node.js. You can narrow it down further with `urlPattern`.
- If the response already has a `content-disposition` header (e.g. `inline`), it is replaced with `content-disposition: attachment`.
- If you only need to change headers, the experimental [`Fetch.continueResponse`](https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-continueResponse) method can modify them without loading the body into Node.js first. This example uses `Fetch.getResponseBody` and `Fetch.fulfillRequest` so you can modify the body too.
- If you only need PDFs downloaded, Chrome's `plugins.always_open_pdf_externally` preference does that without any interception. It has to be set in the browser profile, though, and it doesn't cover XML or any other content type.
- Call [`Fetch.disable`](https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-disable) to stop intercepting requests.

### Playwright's built-in alternative

Newer versions of Playwright can modify responses without CDP by fetching the original response with [`route.fetch()`](https://playwright.dev/docs/api/class-route#route-fetch) and passing it to [`route.fulfill()`](https://playwright.dev/docs/api/class-route#route-fulfill) with your changes. Unlike the CDP approach, `page.route()` isn't tied to Chromium.

```javascript
await page.route('**/*', async (route) => {
  if (route.request().resourceType() !== 'document') {
    return route.continue();
  }

  const response = await route.fetch();
  const headers = response.headers();
  const contentType = (headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();

  if (['application/pdf', 'application/xml', 'text/xml'].includes(contentType)) {
    headers['content-disposition'] = 'attachment';
  }

  await route.fulfill({ response, headers });
});
```

### What does the intercepted object look like in `Fetch.requestPaused`?

In case you're confused what the passed object in `requestPaused` looks like, a log is attached below. The object contains both request and response information. The response body should be retrieved separately using `Fetch.getResponseBody`.

**Code**
```javascript
client.on('Fetch.requestPaused', (reqEvent) => {
  console.log(reqEvent);
});
```

**Console Output**
```javascript
{
  requestId: 'interception-job-14.0',
  request: {
    url: 'https://pdf-xml-download-test.vercel.app/api/file/pdf',
    method: 'GET',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/jxl,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://pdf-xml-download-test.vercel.app/',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Chromium";v="155", "Not(A:Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"'
    },
    initialPriority: 'VeryHigh',
    referrerPolicy: 'strict-origin-when-cross-origin'
  },
  frameId: 'A8363E2E3AE9AB3DA80B3E7DB2305AC6',
  resourceType: 'Document',
  responseStatusCode: 200,
  responseStatusText: '',
  responseHeaders: [
    { name: 'age', value: '0' },
    {
      name: 'cache-control',
      value: 'public, max-age=0, must-revalidate'
    },
    { name: 'content-type', value: 'application/pdf' },
    { name: 'date', value: 'Fri, 16 Oct 2026 11:27:40 GMT' },
    { name: 'server', value: 'Vercel' },
    {
      name: 'strict-transport-security',
      value: 'max-age=63072000; includeSubDomains; preload'
    },
    { name: 'x-nextjs-page', value: '/api/file/pdf' },
    { name: 'x-vercel-cache', value: 'MISS' },
    {
      name: 'x-vercel-id',
      value: 'iad1::sfo1::jnwl7-1792150060359-d1b1cc5b0386'
    },
    { name: 'content-length', value: '13264' }
  ],
  networkId: '671349D5418CDFEDFE7F1897C48D94A6'
}
```
