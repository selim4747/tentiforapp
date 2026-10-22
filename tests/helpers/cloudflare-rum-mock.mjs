const RUM_PATH = '**/cdn-cgi/rum*';
const INSIGHTS = '**/*cloudflareinsights.com/**';
const BEACON_SCRIPT = '**/static.cloudflareinsights.com/beacon.min.js*';
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400'
};

/** Keep Cloudflare telemetry out of browser tests; no real beacon code or cross-origin request is executed. */
export async function mockCloudflareRum(context) {
  await context.route(RUM_PATH, (route) => route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' }));
  await context.route(INSIGHTS, (route) => route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' }));
  await context.route(BEACON_SCRIPT, (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript; charset=utf-8',
    body: '/* Cloudflare Web Analytics is intentionally mocked in tests. */'
  }));
}
