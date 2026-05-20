import '@testing-library/jest-dom'

// Mock Request/Response for Better Auth which relies on native fetch APIs not present in JSDOM testing
if (typeof global.Request === 'undefined') {
  global.Request = class Request {} as any;
}
if (typeof global.Response === 'undefined') {
  global.Response = class Response {} as any;
}
