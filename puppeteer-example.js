const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null, // full viewport size
  });

  const page = await browser.newPage();

  // Create a new Chrome Devtools Protocol Session
  const client = await page.target().createCDPSession();

  /*
    Fetch.enable
    https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-enable

    Enables issuing of requestPaused events. A request will be paused until client calls one of failRequest, fulfillRequest or continueRequest/continueWithAuth.
  */
  await client.send('Fetch.enable', {
    patterns: [
      {
        urlPattern: '*',
        requestStage: 'Response',
      },
    ],
  });

  /*
    Fetch.requestPaused
    https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#event-requestPaused
    
    Issued when the domain is enabled and the request URL matches the specified filter. The request is paused until the client responds with one of continueRequest, failRequest or fulfillRequest. The stage of the request can be determined by presence of responseErrorReason and responseStatusCode -- the request is at the response stage if either of these fields is present and in the request stage otherwise.
  */
  await client.on('Fetch.requestPaused', async (reqEvent) => {
    // Retrieve EventID
    const { requestId } = reqEvent;

    let responseHeaders = reqEvent.responseHeaders || [];
    let contentType = '';

    // Find and store 'content-type' header
    for (let elements of responseHeaders) {
      if (elements.name.toLowerCase() === 'content-type') {
        contentType = elements.value;
      }
    }

    if (contentType.endsWith('pdf') || contentType.endsWith('xml')) {
      // Uncomment the line below to log response headers for debugging
      // console.log(reqEvent.responseHeaders);

      /*
        Fetch.getResponseBody
        https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-getResponseBody

        Causes the body of the response to be received from the server and returned as a single string. May only be issued for a request that is paused in the Response stage and is mutually exclusive with takeResponseBodyForInterceptionAsStream. Calling other methods that affect the request or disabling fetch domain before body is received results in an undefined behavior.
      */
      const responseCdp = await client.send('Fetch.getResponseBody', {
        requestId,
      });

      // Adding 'content-disposition: attachment' header will tell the browser to download the file instead of opening it in using built-in viewer
      responseHeaders.push({
        name: 'content-disposition',
        value: 'attachment',
      });

      /*
        Fetch.fulfillRequest
        https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-fulfillRequest

        Provides response to the request.
      */
      await client.send('Fetch.fulfillRequest', {
        requestId,
        responseCode: 200,
        responseHeaders,
        body: responseCdp.body,
      });
    } else {
      // If the content-type is not what we're looking for, continue the request without modifying the response
      await client.send('Fetch.continueRequest', { requestId });
    }
  });

  await page.goto('https://pdf-xml-download-test.vercel.app/');

  await page.waitFor(100000);

  await browser.close();
})();
