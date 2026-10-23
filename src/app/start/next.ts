// The page to land on after sign-in: a same-site path from ?next=, else /home. Blocks "//host" and "/\host", and any control character:
// browsers drop tabs and newlines when they read an address, so "/\t/evil.com" would otherwise turn into "//evil.com".
export const nextPath = () => {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && /^\/[^/\\]/.test(next) && !/[\u0000-\u001f\u007f\\]/.test(next) ? next : '/home';
};
