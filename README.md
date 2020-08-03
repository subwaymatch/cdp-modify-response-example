# Modifying Response Headers in Puppeteer & Playwright

What these examples do:

1. :wrench: Creates a new Chrome-Devtools-Protocol (CDP) session using [Puppeteer](https://pptr.dev) or [Playwright](https://playwright.dev).
2. :hammer: Enable `Fetch` domain to let us substitute browser's network layer with our own code.
3. :eyes: Pause every request and check `content-type` header to match `pdf` and `xml` types.
4. :fast_forward: If the `content-type` is not what we are looking for, resume the request without any change.
5. :dart: If the `content-type` is what we're looking for (`pdf` or `xml`), add a `content-disposition: attachment` response header to make the browser download the file instead of opening it in Chromium's built-in viewers.

<br /><br />
**A visual overview**
<p align="center">
 <img src="https://user-images.githubusercontent.com/1064036/89190675-66b97780-d567-11ea-89eb-58e2d94350d3.png" width="720" alt="cdp-modify-response-header" />
</p>

## Usage

### Installing Dependencies
Using `npm`
```
$ npm install
```
Using `yarn`
```
$ yarn install
```

### Run
Depending on whether you want to use Puppeteer or Playwright, run one of the following commands.
```bash
$ node puppeteer-example.js
```

```bash
$ node playwright-example.js
```

## Notes

- Codes for [Puppeteer](https://pptr.dev) or [Playwright](https://playwright.dev) are almost identical. They have subtle differences in creating a new CDP session, but all other code are pretty much the same.
- Chromium is the only browser that will work with this example. Using Firefox or Webkit browsers will throw errors.
- You can specify more specific patterns when enabling `requestPaused` events with `Fetch.enable`. For simplicity's sake, this example captures all requests at `Response` stage.


### What does the intercepted object look like in `Fetch.requestPaused`?

In case you're confused what the passed object in `requestPaused` looks like, a log is attached below. The object contains both request and response information. The response body should be retrieved separately using `Fetch.getResponseBody`.

**Code**
```javascript
 await client.on('Fetch.requestPaused', async (reqEvent) => { console.log(reqEvent); }
```

**Console Output**
```javascript
{
  requestId: 'interception-job-17.0',
  request: {
    url: 'https://pdf-xml-download-test.vercel.app/api/file/pdf',
    method: 'GET',
    headers: {
      'sec-ch-ua': '"Chromium";v="85", "\\\\Not;A\\"Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4182.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',        
      Referer: 'https://pdf-xml-download-test.vercel.app/'
    },
    initialPriority: 'VeryHigh',
    referrerPolicy: 'strict-origin-when-cross-origin'
  },
  frameId: 'CC3923414718B2309C50E21BCFB3DDF0',
  resourceType: 'Document',
  responseStatusCode: 200,
  responseHeaders: [
    { name: 'status', value: '200' },
    { name: 'content-type', value: 'application/pdf' },
    { name: 'x-nextjs-page', value: '/api/file/pdf' },
    { name: 'date', value: 'Mon, 03 Aug 2020 11:47:24 GMT' },
    {
      name: 'cache-control',
      value: 'public, max-age=0, must-revalidate'
    },
    { name: 'content-length', value: '516719' },
    { name: 'x-vercel-cache', value: 'MISS' },
    { name: 'age', value: '0' },
    { name: 'server', value: 'Vercel' },
    {
      name: 'x-vercel-id',
      value: 'cle1::sfo1::flf5q-1596455244871-be3d3dcbd2ec'
    },
    {
      name: 'strict-transport-security',
      value: 'max-age=63072000; includeSubDomains; preload'
    }
  ],
  networkId: 'CC3631EE0BC63C579EDF277C2CDEE85D'
}
```
