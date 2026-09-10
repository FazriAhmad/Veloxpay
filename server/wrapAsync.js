// Express 4 doesn't forward rejected promises from async handlers to error middleware —
// an unhandled rejection here would otherwise crash the whole process. Wrap every async route.
export const wrapAsync = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
