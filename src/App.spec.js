import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App.vue'
import { users } from '../js/users.js'

/**
 * Component-level tests for the login logic.
 *
 * These deliberately overlap with the end-to-end suite, and that is the point.
 * The browser tests prove a real person can sign in through a real browser; they
 * take a couple of seconds each and need a built app and a running server. These
 * run in milliseconds and go straight at the branches inside logIn(), logOut()
 * and clearError(). When one of them fails you know it is the component's logic,
 * not the rendering, the styling or the server.
 *
 * The split follows the usual rule: if a behaviour can be proven below the UI,
 * prove it below the UI, and keep the expensive browser tests for the journeys
 * that genuinely need a browser.
 *
 * Credentials come from js/users.js, the same source the e2e suite uses. App.vue
 * keeps its own hand-copied list of the same users, so if the two ever drift
 * these tests fail - which is the only automated warning that duplication has
 * gone stale.
 */

const [firstUser, secondUser] = users

function mountApp() {
  return mount(App)
}

describe('App login logic', () => {
  beforeEach(() => {
    // Every test starts signed out. localStorage is shared across tests in the
    // same jsdom environment, so without this a signed-in test would leak into
    // whichever test happened to run next.
    localStorage.clear()
  })

  describe('logIn', () => {
    it('signs in a known user and remembers who it was', async () => {
      const wrapper = mountApp()

      await wrapper.find('#email').setValue(firstUser.email)
      await wrapper.find('#password').setValue(firstUser.password)
      await wrapper.find('form').trigger('submit')

      expect(localStorage.getItem('logged')).toBe(firstUser.email)
      expect(wrapper.vm.isLoggedIn).toBe(true)
    })

    it('stores the identity that actually signed in, not just any of them', async () => {
      // Guards against a lookup that finds a match and then writes the wrong
      // record - the sort of bug that leaves everyone logged in as user one.
      const wrapper = mountApp()

      await wrapper.find('#email').setValue(secondUser.email)
      await wrapper.find('#password').setValue(secondUser.password)
      await wrapper.find('form').trigger('submit')

      expect(localStorage.getItem('logged')).toBe(secondUser.email)
    })

    it('rejects a known user with the wrong password', async () => {
      const wrapper = mountApp()

      await wrapper.find('#email').setValue(firstUser.email)
      await wrapper.find('#password').setValue('not-the-password')
      await wrapper.find('form').trigger('submit')

      expect(localStorage.getItem('logged')).toBeNull()
      expect(wrapper.vm.isLoggedIn).toBe(false)
      expect(wrapper.vm.errorMessage).toBe('Invalid email or password. Please try again.')
    })

    it('will not accept one user\'s email with another user\'s password', async () => {
      // The two fields have to be checked as a pair. Looking them up
      // independently would let any valid password admit any valid email.
      const wrapper = mountApp()

      await wrapper.find('#email').setValue(firstUser.email)
      await wrapper.find('#password').setValue(secondUser.password)
      await wrapper.find('form').trigger('submit')

      expect(localStorage.getItem('logged')).toBeNull()
    })

    it('rejects an empty submission rather than matching on empty strings', async () => {
      const wrapper = mountApp()

      await wrapper.find('form').trigger('submit')

      expect(localStorage.getItem('logged')).toBeNull()
      expect(wrapper.vm.errorMessage).toBeTruthy()
    })

    it('clears both fields once the sign-in succeeds', async () => {
      // Otherwise the previous user's password is still sitting in the form when
      // the next person is shown it.
      const wrapper = mountApp()

      await wrapper.find('#email').setValue(firstUser.email)
      await wrapper.find('#password').setValue(firstUser.password)
      await wrapper.find('form').trigger('submit')

      expect(wrapper.vm.email).toBe('')
      expect(wrapper.vm.password).toBe('')
    })
  })

  describe('clearError', () => {
    it('drops the error as soon as either field is edited', async () => {
      const wrapper = mountApp()

      await wrapper.find('#email').setValue(firstUser.email)
      await wrapper.find('#password').setValue('wrong')
      await wrapper.find('form').trigger('submit')
      expect(wrapper.vm.errorMessage).toBeTruthy()

      await wrapper.find('#email').setValue('a')
      expect(wrapper.vm.errorMessage).toBe('')
    })
  })

  describe('logOut', () => {
    it('removes the stored session rather than only hiding the view', async () => {
      // Hiding the signed-in view without clearing storage looks identical on
      // screen and puts the user straight back in on the next refresh.
      localStorage.setItem('logged', firstUser.email)
      const wrapper = mountApp()
      expect(wrapper.vm.isLoggedIn).toBe(true)

      wrapper.vm.logOut()

      expect(localStorage.getItem('logged')).toBeNull()
      expect(wrapper.vm.isLoggedIn).toBe(false)
    })
  })

  describe('checkLogged on mount', () => {
    it('starts signed out when there is nothing stored', () => {
      expect(mountApp().vm.isLoggedIn).toBe(false)
    })

    it('picks up an existing session on load', () => {
      localStorage.setItem('logged', firstUser.email)

      expect(mountApp().vm.isLoggedIn).toBe(true)
    })

    it('treats any non-empty value as a valid session', () => {
      // Documents current behaviour rather than endorsing it: there is no server
      // and no token, so anything in this key gets you in. Recorded here and in
      // the e2e suite so the limitation is visible rather than assumed.
      localStorage.setItem('logged', 'not-a-registered-user')

      expect(mountApp().vm.isLoggedIn).toBe(true)
    })
  })
})
