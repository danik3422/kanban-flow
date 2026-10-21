import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldBlockAccountGateRoute } from './authRouteRules.js'

test('allows password reset and email verification routes while a user still needs verification', () => {
  const authUser = { emailVerified: false, profileSetup: false }

  assert.equal(shouldBlockAccountGateRoute('/login/resetpassword', authUser), false)
  assert.equal(shouldBlockAccountGateRoute('/login/verify-email', authUser), false)
  assert.equal(shouldBlockAccountGateRoute('/verify-email', authUser), false)
  assert.equal(shouldBlockAccountGateRoute('/workspaces', authUser), true)
})

test('allows reset links and profile setup while setup is still pending', () => {
  const authUser = { emailVerified: true, profileSetup: false }

  assert.equal(shouldBlockAccountGateRoute('/setup-profile', authUser), false)
  assert.equal(shouldBlockAccountGateRoute('/login/resetpassword', authUser), false)
  assert.equal(shouldBlockAccountGateRoute('/workspaces', authUser), true)
})
