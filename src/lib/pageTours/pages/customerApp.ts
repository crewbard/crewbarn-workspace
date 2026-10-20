import type { PageTour } from '../types'

/**
 * Your business → Customer app (/tool-shed/customer-app).
 *
 * The worked example of a smart page tour: the steps follow what is on the
 * page right now. Whether the app is paid for, building, ready or failed;
 * whether there are files to download or test copies to try; whether the
 * Apple key is in. Parts that aren't on the page are skipped.
 *
 * The page marks its state for the tour:
 *   custapp-status   data-app-state = paid | building | ready | failed
 *   custapp-ios      data-apple-key = saved | missing
 *   custapp-iphone-try data-testflight = sent | not-sent | none
 *   custapp-download-* data-ready = yes | no
 *   custapp-icon     data-has-icon = yes | no
 */
const t = (id: string) => `[data-tour="${id}"]`
const state = (s: string) => `${t('custapp-status')}[data-app-state="${s}"]`
const KEY_SAVED = `${t('custapp-ios')}[data-apple-key="saved"]`

export const PAGE_TOUR: PageTour = {
  id: 'customer-app',
  route: '^/tool-shed/customer-app/?$',
  intro: {
    page: 'Customer app',
    purpose: 'Build your own phone app, with your name and icon, that opens straight into your customer portal. Customers who join through it see only your company.',
    covers: ['Where your app is', 'Downloads and test copies', 'Name, icon and style', 'What’s in the app', 'iPhone setup', 'Building again'],
  },
  steps: [
    // ── Where the app is ──
    {
      id: 'token', selector: t('custapp-tokens'),
      title: 'A token is waiting',
      say: 'You have a token waiting. Press Use this token to put it toward your builds.',
    },
    {
      id: 'state', title: 'Where your app is', say: '',
      variants: [
        {
          when: state('building'), selector: t('custapp-status'),
          title: 'Building now',
          say: 'Your app is building right now. It usually takes ten to twenty-five minutes, and you can leave this page while it runs.',
        },
        {
          when: state('ready'), selector: t('custapp-status'),
          title: 'Ready to download',
          say: 'Your app is ready to download. The files are just below, and you can try it on a phone first.',
        },
        {
          when: state('failed'), selector: t('custapp-status'),
          title: 'The last build stopped',
          say: 'The last build didn’t finish, and the reason is shown here. Fix it, then build again. If the problem was on our side, it doesn’t use a build.',
        },
        {
          when: state('paid'), selector: t('custapp-status'),
          title: 'Paid and ready to build',
          say: 'Your app is paid for and ready to build. Check the name and icon, then build it.',
        },
        {
          when: `!${t('custapp-status')}`, selector: t('custapp-buy'),
          title: 'Not paid for yet',
          say: 'Your app isn’t paid for yet. Set up the name, icon and features first, then buy a token here. One token covers three builds.',
        },
      ],
    },
    {
      id: 'watch', selector: t('custapp-watch-build'), when: state('building'),
      title: 'Watch the build',
      say: 'Watch build shows each step as it happens. Cancel build stops it without using up a build.',
    },
    {
      id: 'builds-used', selector: t('custapp-builds-used'),
      title: 'Builds used',
      say: 'This line shows when your app was paid for, and how many of your builds you’ve used.',
    },

    // ── Downloads ──
    {
      id: 'android', selector: t('custapp-download-android'), title: 'Android file', say: '',
      variants: [
        { when: `${t('custapp-download-android')}[data-ready="yes"]`, say: 'This is your Android file for Google Play. Download it when you’re ready to list your app.' },
        { when: `${t('custapp-download-android')}[data-ready="no"]`, say: 'Your Android file shows up here once a build finishes.' },
      ],
    },
    {
      id: 'iphone-file', selector: t('custapp-download-ios'), title: 'iPhone file', say: '',
      variants: [
        { when: `${t('custapp-download-ios')}[data-ready="yes"]`, say: 'This is your iPhone file for the App Store. Most of the time it’s sent to Apple for you, so you may never need to download it.' },
        { when: `${t('custapp-download-ios')}[data-ready="no"]`, say: 'No iPhone file yet. Add your Apple details in step three, and your next build makes one.' },
      ],
    },

    // ── Try it on a phone first ──
    {
      id: 'try-phone', selector: t('custapp-try-phone'), title: 'Try it on a phone first', say: '',
      variants: [
        {
          when: t('custapp-qr'), selector: t('custapp-qr'),
          say: 'Try it on a phone first. Point an Android phone’s camera at this code to install a test copy. It’s the same app your customers will get.',
        },
        {
          when: `!${t('custapp-qr')}`,
          say: 'A test copy comes with every build. The code to install it shows up here when it’s ready.',
        },
      ],
    },
    {
      id: 'apk', selector: t('custapp-apk'),
      title: 'Or download the APK',
      say: 'No camera handy? Open this link on the phone to download the test copy and install it.',
    },
    {
      id: 'testflight', selector: t('custapp-iphone-try'), title: 'iPhone test copy', say: '',
      variants: [
        {
          when: `${t('custapp-iphone-try')}[data-testflight="sent"]`,
          say: 'Your iPhone test copy went to TestFlight. Add yourself as a tester in App Store Connect, then open the invite in the TestFlight app.',
        },
        {
          when: `${t('custapp-iphone-try')}[data-testflight="not-sent"]`,
          say: 'This build didn’t go to TestFlight, and the reason is shown here. Often the app just needs to be created in App Store Connect first.',
        },
        {
          when: `${t('custapp-iphone-try')}[data-apple-key="missing"]`,
          say: 'Want to try it on an iPhone too? Add your Apple details in step three, and your next build sends a test copy to TestFlight.',
        },
        {
          when: t('custapp-iphone-try'),
          say: 'Your iPhone test copy goes to TestFlight once a build finishes. It can take Apple up to half an hour to show it.',
        },
      ],
    },

    // ── More builds, links ──
    {
      id: 'more-builds', selector: t('custapp-more-builds'),
      title: 'Need more builds?',
      say: 'Open this to apply another token, or buy three more builds.',
    },
    {
      id: 'web-link', selector: t('custapp-web-link'),
      title: 'Web link',
      say: 'This link opens the same app in a web browser. Put it on your website for anyone who’d rather not install anything.',
    },
    {
      id: 'privacy', selector: t('custapp-privacy-url'),
      title: 'Privacy policy',
      say: 'Both app stores ask for a privacy policy. We wrote one for you, and this is its link.',
    },

    // ── 1. Name and icon ──
    {
      id: 'name-section', selector: t('custapp-name'),
      title: '1. Name and icon',
      say: 'Step one is your app’s name and icon. They’re what people see on their phone.',
    },
    {
      id: 'icon', selector: t('custapp-icon'), title: 'App icon',
      say: 'Upload a square picture, ideally 1024 pixels wide. Until you do, the icon is your first letter on your colour.',
      variants: [
        { when: `${t('custapp-icon')}[data-has-icon="yes"]`, say: 'This is your app icon. Press Change icon any time to swap in a new square picture.' },
      ],
    },
    {
      id: 'app-name', selector: t('custapp-app-name'),
      title: 'App name',
      say: 'The name under the icon and in the stores. Keep it short, up to thirty characters.',
    },
    {
      id: 'color', selector: t('custapp-color'),
      title: 'Brand colour',
      say: 'This colour fills the opening screen and the header. It starts as your brand colour.',
    },

    // ── App style ──
    {
      id: 'style', selector: t('custapp-style-picker'), waitMs: 1200,
      title: 'App style',
      say: 'Pick one of four looks: Classic, Tiles, Dashboard or Dock. You can switch any time, even after it’s in the stores, with no new build.',
    },
    {
      id: 'try', selector: t('custapp-try'),
      title: 'Try your app',
      say: 'Try your app opens the real app on a pretend phone, with sample customers and jobs. Nothing is sent, and it costs no build.',
    },

    // ── 2. What's in the app ──
    {
      id: 'features', selector: t('custapp-features'),
      title: '2. What’s in the app',
      say: 'Step two: tick what customers can do in your app. You can change it later and build again.',
    },

    // ── 3. iPhone ──
    {
      id: 'ios', selector: t('custapp-ios'), title: '3. iPhone',
      say: 'Step three is only for iPhone. Apple needs a key from your own Apple developer account. Android needs nothing from you.',
      variants: [
        { when: KEY_SAVED, say: 'Step three is for iPhone. Your Apple key is saved, so every build makes an iPhone version too.' },
      ],
    },
    {
      id: 'ios-ids', selector: t('custapp-ios-ids'), when: `!${KEY_SAVED}`,
      title: 'Apple IDs',
      say: 'Paste your Team ID, Key ID and Issuer ID from App Store Connect.',
    },
    {
      id: 'ios-key', selector: t('custapp-ios-key'), title: 'Apple key',
      say: 'Paste the contents of your Apple key file here. It’s stored encrypted and never shown again.',
      variants: [
        { when: KEY_SAVED, say: 'Your Apple key is saved and locked away. Leave this box empty to keep it.' },
      ],
    },

    // ── Save, token ──
    {
      id: 'save', selector: t('custapp-save'),
      title: 'Saved as you go',
      say: 'Everything on this page saves itself a moment after you change it. The build buttons wait until it says all changes saved.',
    },
    {
      id: 'redeem', selector: t('custapp-redeem'),
      title: 'Have a token?',
      say: 'Got a token from us, or bought one already? Type the code and press Apply token.',
    },

    // ── Build again ──
    {
      id: 'build', selector: t('custapp-build-button'), when: `!${state('building')}`, title: 'Build again',
      say: 'Changed something? Build again makes fresh copies of your app. A quick check opens first, and nothing starts until you say so.',
      variants: [
        {
          when: `${t('custapp-build-button')}[data-first-build="yes"]`, title: 'Build my app',
          say: 'Build my app makes your Android and iPhone versions. A quick check opens first, and nothing starts until you say so.',
        },
      ],
    },
    {
      id: 'confirm', selector: t('custapp-build-confirm'),
      title: 'Ready to build?',
      say: 'This quick check shows a last look at your name, icon, style and Apple key. Build now starts it. Go back changes nothing.',
    },
    {
      id: 'builds-left', selector: t('custapp-builds-left'),
      title: 'Builds left',
      say: 'Here’s how many builds you have, and how many will be left after this one.',
    },

    // ── Listing ──
    {
      id: 'listing', selector: t('custapp-listing'),
      title: 'Listing it on the stores',
      say: 'When you’re ready, these steps walk you through Google Play and the App Store. You publish under your own accounts, so the app stays yours.',
    },
  ],
}
