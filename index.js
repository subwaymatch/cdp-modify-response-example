const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
  });
  const page = await browser.newPage();

  const client = await page.target().createCDPSession();

  await client.send('Fetch.enable', {
    patterns: [
      {
        urlPattern: '*',
        requestStage: 'Response',
      },
    ],
  });

  await client.on('Fetch.requestPaused', async (reqEvent) => {
    console.log('Fetch.requestPaused');

    let headers = reqEvent.responseHeaders || [];
    let contentType = '';
    for (let elements of headers) {
      if (elements.name.toLowerCase() === 'content-type') {
        contentType = elements.value;
      }
    }

    const { requestId } = reqEvent;

    if (contentType.endsWith('pdf')) {
      console.log('====================');
      console.log('PDF REQUEST!!');
      console.log('====================');
      console.log(reqEvent);

      console.log('====================');
      console.log('RESPONSE HEADERS');
      console.log('====================');
      console.log(reqEvent.responseHeaders);

      const responseCdp = await client.send('Fetch.getResponseBody', {
        requestId,
      });
      console.log(
        `Response body for ${requestId} is ${responseCdp.body.length} bytes`
      );

      console.log(`responseCdp.keys`);
      console.log(Object.keys(responseCdp));
    } else {
      await client.send('Fetch.continueRequest', { requestId });
    }
  });

  await page.goto('https://pdf-xml-download-test.vercel.app/');

  await page.waitFor(200000);

  // await browser.close();
})();
