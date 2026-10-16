import path from 'node:path';
import puppeteer from 'puppeteer';

// Content types that Chromium would otherwise open in its built-in PDF and XML viewers
const DOWNLOAD_CONTENT_TYPES = new Set(['application/pdf', 'application/xml', 'text/xml']);

// Returns the 'content-type' header without parameters, e.g. 'text/xml; charset=utf-8' -> 'text/xml'
function getContentType(headers) {
  const header = headers.find((h) => h.name.toLowerCase() === 'content-type');
  return (header?.value ?? '').split(';')[0].trim().toLowerCase();
}

const browser = await puppeteer.launch({
  headless: false,
  defaultViewport: null, // full viewport size
  downloadBehavior: {
    policy: 'allow',
    downloadPath: path.resolve('downloads'),
  },
});

// Use the tab that opens with the browser
const [page] = await browser.pages();

// Create a new Chrome DevTools Protocol session
const client = await page.createCDPSession();

/*
  Fetch.enable
  https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-enable

  Enables issuing of requestPaused events. A request will be paused until client calls one of failRequest, fulfillRequest or continueRequest/continueWithAuth.
*/
await client.send('Fetch.enable', {
  patterns: [
    {
      urlPattern: '*',
      // Only pause pages and frames, not images, scripts, stylesheets, etc.
      resourceType: 'Document',
      requestStage: 'Response',
    },
  ],
});

/*
  Fetch.requestPaused
  https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#event-requestPaused

  Issued when the domain is enabled and the request URL matches the specified filter. The request is paused until the client responds with one of continueRequest, failRequest or fulfillRequest. The stage of the request can be determined by presence of responseErrorReason and responseStatusCode -- the request is at the response stage if either of these fields is present and in the request stage otherwise.
*/
client.on('Fetch.requestPaused', async (reqEvent) => {
  const { requestId, request, responseStatusCode, responseHeaders = [] } = reqEvent;

  try {
    if (!DOWNLOAD_CONTENT_TYPES.has(getContentType(responseHeaders))) {
      // If the content-type is not what we're looking for, continue the request without modifying the response
      await client.send('Fetch.continueRequest', { requestId });
      return;
    }

    // Adding 'content-disposition: attachment' header will tell the browser to download the file instead of opening it in a built-in viewer
    // Any existing 'content-disposition' header (e.g. 'inline') is replaced
    const headers = responseHeaders.filter((h) => h.name.toLowerCase() !== 'content-disposition');
    headers.push({ name: 'content-disposition', value: 'attachment' });

    /*
      Fetch.getResponseBody
      https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-getResponseBody

      Causes the body of the response to be received from the server and returned as a single string. May only be issued for a request that is paused in the Response stage and is mutually exclusive with takeResponseBodyForInterceptionAsStream. Calling other methods that affect the request or disabling fetch domain before body is received results in an undefined behavior.
    */
    const { body, base64Encoded } = await client.send('Fetch.getResponseBody', { requestId });

    /*
      Fetch.fulfillRequest
      https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-fulfillRequest

      Provides response to the request.
    */
    await client.send('Fetch.fulfillRequest', {
      requestId,
      responseCode: responseStatusCode,
      responseHeaders: headers,
      // fulfillRequest expects a base64-encoded body, and getResponseBody reports whether it already is
      body: base64Encoded ? body : Buffer.from(body).toString('base64'),
    });

    console.log(`Forced download: ${request.url}`);
  } catch (error) {
    console.error(`Failed to handle ${request.url}: ${error.message}`);
  }
});

await page.goto('https://pdf-xml-download-test.vercel.app/');

console.log('Click the PDF and XML links to download them to ./downloads. Close the browser to exit.');

// Keep the script running until the browser is closed
await new Promise((resolve) => browser.once('disconnected', resolve));
