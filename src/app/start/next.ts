// The page to land on after sign-in: a same-site path from ?next=, else /home. Blocks "//host" and "/\host".
export const nextPath = () => {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && /^\/[^/\\]/.test(next) ? next : '/home';
};
