export const accountGateAllowedRoutes = [
  '/login/resetpassword',
  '/login/verify-email',
  '/verify-email',
  '/setup-profile',
]

export const shouldBlockAccountGateRoute = (pathname, authUser) => {
  if (!authUser) return false

  if (accountGateAllowedRoutes.includes(pathname)) {
    return false
  }

  return true
}
