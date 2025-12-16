import { proxy } from './src/proxy';

export const config = {
  matcher: [
    '/app/:path*',
    '/api/pro/:path*',
    '/api/personal/:path*',
    '/api/performance/:path*',
  ],
};
export default proxy;
