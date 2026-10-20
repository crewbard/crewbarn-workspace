import type { PageTour } from '../types'

/**
 * Your business → Your website (/website-builder).
 *
 * Two shapes. A company with no site yet gets the four steps that build the
 * first one; a company with a site gets the studio (tabs on the left, the
 * live preview on the right). Only what is on screen is walked. The page
 * marks its state for the tour:
 *   site-header data-step = basics | look | edit | go-live, data-live = yes | no  (the four steps)
 *   site-studio data-tab = home | edit | blog | look | google | reviews | golive, data-live = yes | no  (the studio)
 *   site-golive-checklist data-ready = yes | no
 *   site-read-only shows for people who can look but not change.
 */
const t = (id: string) => `[data-tour="${id}"]`
const step = (s: string) => `${t('site-header')}[data-step="${s}"]`
const tab = (s: string) => `${t('site-studio')}[data-tab="${s}"]`
const LIVE = `${t('site-header')}[data-live="yes"]`

export const PAGE_TOUR: PageTour = {
  id: 'website',
  route: '^/website-builder/?$',
  intro: {
    page: 'Your website',
    purpose: 'Build your website, then look after it: change any word, write posts from your jobs, pick a look, get on Google and answer reviews. Nothing goes public until you publish.',
    covers: ['Website home', 'Editing with a live preview', 'Blog from jobs', 'Look', 'Google', 'Review replies', 'Publish and undo', 'Building a first site'],
  },
  steps: [
    // ── The studio (a site exists) ──
    {
      id: 'studio', selector: t('site-studio'), title: 'Your website',
      say: 'This bar is always here. It shows if your site is live and how many changes are waiting in your draft.',
    },
    {
      id: 'studio-changes', selector: t('site-changes'), title: 'Changes in draft',
      say: 'Everything you change is saved as a draft. This counts what will change when you publish.',
    },
    {
      id: 'studio-undo', selector: t('site-undo'), title: 'Undo',
      say: 'Undo takes back your last change, one step at a time.',
    },
    {
      id: 'studio-device', selector: t('site-device'), title: 'Computer or phone',
      say: 'See the preview the way a computer or a phone shows it.',
    },
    {
      id: 'studio-history', selector: t('site-history'), title: 'History',
      say: 'Every time you published. You can copy an old version back into your draft. That never publishes on its own.',
    },
    {
      id: 'studio-publish', selector: t('site-publish'), title: 'Publish',
      say: 'Publish puts your draft on your live site. Until then, visitors see the last version you published.',
    },
    {
      id: 'studio-tabs', selector: t('site-tabs'), title: 'The tabs',
      say: 'Pick what to work on here. The preview on the right shows your real site as you go.',
    },
    {
      id: 'studio-preview', selector: t('site-preview'), title: 'Live preview',
      say: 'This is your real site with your draft in it. Only you can see it.',
    },
    {
      id: 'home-health', selector: t('site-home-health'), when: tab('home'), title: 'Is my site OK?',
      say: 'A quick check: live or not, your domain, Google, and how many pages have their own Google title.',
    },
    {
      id: 'home-week', selector: t('site-home-week'), when: tab('home'), title: 'On Google',
      say: 'Your real clicks and searches from Google. This shows once your site is set up there.',
    },
    {
      id: 'home-todo', selector: t('site-home-todo'), when: tab('home'), title: 'To do',
      say: 'Jobs ready for a post, review replies waiting, and anything else that needs you.',
    },
    {
      id: 'edit-tools', selector: t('site-edit-tools'), when: tab('edit'), title: 'What to edit',
      say: 'Pick a page or a setting. Type, and the preview changes a moment later.',
    },
    {
      id: 'edit-seo', selector: t('site-page-seo'), when: tab('edit'), title: 'On Google',
      say: 'Each page can have its own Google title and description. Leave them empty to use the grey text.',
    },
    {
      id: 'edit-hours', selector: t('site-edit-hours'), when: tab('edit'), title: 'Business hours',
      say: 'Your hours show on the site and on Google. Your phone number comes from Company info.',
    },
    {
      id: 'edit-reviews', selector: t('site-edit-reviews'), when: tab('edit'), title: 'Reviews on your site',
      say: 'Choose Google or typed-in reviews, and pick up to six to feature.',
    },
    {
      id: 'blog-auto', selector: t('site-blog-auto'), when: tab('blog'), title: 'Posts on their own',
      say: 'Turn this on and a post is drafted when a job is finished with enough photos. You approve it before it goes up.',
    },
    {
      id: 'blog-jobs', selector: t('site-blog-jobs'), when: tab('blog'), title: 'Pick a job',
      say: 'Finished jobs with website photos. Only the town is shown, never the customer.',
    },
    {
      id: 'blog-photos', selector: t('site-blog-photos'), when: tab('blog'), title: 'Pick photos',
      say: 'Tap photos to add them. The first one is the cover.',
    },
    {
      id: 'blog-post', selector: t('site-blog-post'), when: tab('blog'), title: 'Your post',
      say: 'Change the title and words, or write it again. It goes up when you publish.',
    },
    {
      id: 'look-themes', selector: t('site-look-themes'), when: tab('look'), title: 'Pick a theme',
      say: 'Each card is your own site. Point at one to see it big, click to use it.',
    },
    {
      id: 'look-accent', selector: t('site-look-accent'), when: tab('look'), title: 'Accent colour',
      say: 'Pick your website colours. Your invoices keep their own.',
    },
    {
      id: 'google-connect', selector: t('site-google-connect'), when: tab('google'), title: 'Sign in with Google',
      say: 'Sign in once with your business Google account. CrewBarn does the rest.',
    },
    {
      id: 'google-setup', selector: t('site-google-setup'), when: tab('google'), title: 'Getting on Google',
      say: 'CrewBarn adds your site, proves it is yours and sends your page list. A tick means that step is done.',
    },
    {
      id: 'google-business', selector: t('site-google-business'), when: tab('google'), title: 'Business Profile',
      say: 'Link your Google listing, and share new blog posts to it if you like.',
    },
    {
      id: 'google-stand', selector: t('site-google-stand'), when: tab('google'), title: 'Where you stand',
      say: 'Your searches, clicks and pages on Google over the last 28 days.',
    },
    {
      id: 'google-manual', selector: t('site-google-manual'), when: tab('google'), title: 'Do it yourself',
      say: 'Rather do it by hand? The old steps are still here.',
    },
    {
      id: 'reviews-settings', selector: t('site-reviews-settings'), when: tab('reviews'), title: 'How replies work',
      say: 'Choose which reviews get a reply on their own, the tone, and your signature.',
    },
    {
      id: 'reviews-list', selector: t('site-reviews-list'), when: tab('reviews'), title: 'Replies',
      say: 'Edit a draft, write it again, or approve and post it.',
    },

    // ── The four steps (building the first site) ──
    {
      id: 'header', selector: t('site-header'), title: 'Your website workshop',
      say: 'This is your website workshop. Changes save themselves as a draft, and nothing goes public until you turn your website on.',
      variants: [
        {
          when: LIVE,
          say: 'This is your website workshop. Your site is live. Changes are saved as a draft until you publish.',
        },
      ],
    },
    {
      id: 'read-only', selector: t('site-read-only'),
      title: 'View only',
      say: 'You can look around, but nothing you change here is saved. Ask an owner or admin if the website needs updating.',
    },
    {
      id: 'steps', selector: t('site-steps'),
      title: 'Four steps',
      say: 'Basics, Look, Edit and Go live. A tick means that step is done, and you can click back to it any time.',
    },

    // ── Basics ──
    {
      id: 'already', selector: t('site-already-built'),
      title: 'You already have a website',
      say: 'You already have a site, so there’s no need to answer the questions again. Pick how it looks carries on. Starting over rewrites every word, but keeps your pictures and colours.',
    },
    {
      id: 'basics', selector: t('site-basics'),
      title: 'A few quick questions',
      say: 'Answer a few quick questions, like what work you do and where. CrewBarn writes your first draft from them, and you can change everything afterwards.',
    },
    {
      id: 'writing', selector: t('site-writing'),
      title: 'Writing your website',
      say: 'Your website is being written. It takes a minute or two. You can watch, or come back later.',
    },

    // ── Look ──
    {
      id: 'look', selector: t('site-look'), when: step('look'),
      title: 'Pick how it looks',
      say: 'Choose the shape of your home page, your colours and your pictures. You can change all of it later.',
    },
    {
      id: 'look-layout', selector: t('site-look-layout'), when: step('look'),
      title: 'The shape of your home page',
      say: 'Each shape leads with something different, like what you do, or your reviews, or a big picture.',
    },
    {
      id: 'look-colour', selector: t('site-look-colour'), when: step('look'),
      title: 'Your colour',
      say: 'Tap a colour pair for your website. It’s just for the website, so your invoices keep their own colour.',
    },
    {
      id: 'look-pictures', selector: t('site-look-pictures'), when: step('look'),
      title: 'Your pictures',
      say: 'Add a photo across the top, your logo, and the little icon on the browser tab.',
    },
    {
      id: 'look-device', selector: t('site-look-device'), when: step('look'),
      title: 'Computer or phone',
      say: 'Switch the preview between a computer and a phone to see how it looks on each.',
    },

    // ── Edit ──
    {
      id: 'tools', selector: t('site-studio-rail'), when: step('edit'),
      title: 'The editing tools',
      say: 'Pick a tool down the side. Each one does one job, like colours, pages, services or the towns you cover, and it all saves itself.',
    },
    {
      id: 'tool-seo', selector: t('site-tool-seo'), when: step('edit'),
      title: 'Google & SEO',
      say: 'Google and SEO sets how you look in Google results: the heading, the lines under it, and the words people search for.',
    },
    {
      id: 'tool-google', selector: t('site-tool-google'), when: step('edit'),
      title: 'On Google',
      say: 'On Google gets your website listed. Sign in with Google and CrewBarn adds the site, proves it is yours and sends your page list. Or follow the five steps here yourself.',
    },
    {
      id: 'tool-services', selector: t('site-tool-services'), when: step('edit'),
      title: 'Services and towns',
      say: 'Services gives each kind of work its own page, and Service area does the same for each town you cover, so people nearby find you.',
    },
    {
      id: 'tool-panel', selector: t('site-tool'), when: step('edit'),
      title: 'Where you work on it',
      say: 'The tool you picked opens here.',
    },

    // ── On Google (open in the Edit step) ──
    {
      id: 'google-steps', selector: t('site-google-steps'), when: step('edit'),
      title: 'Five steps to Google',
      say: 'Follow these five steps once. Open Google Search Console, add your domain, copy the code Google shows you, paste it here, then click Verify in Google.',
    },
    {
      id: 'google-code', selector: t('site-google-code'), when: step('edit'),
      title: 'Paste Google’s code',
      say: 'Paste the code here. With Cloudflare connected, CrewBarn adds it to your domain for you. Without it, you see exactly what to add and where.',
    },
    {
      id: 'google-sitemap', selector: t('site-google-sitemap'), when: step('edit'),
      title: 'Your page list',
      say: 'This is the list of every page on your website. Copy it into Sitemaps in Search Console so Google reads them all.',
    },
    {
      id: 'google-status', selector: t('site-google-status'), when: step('edit'),
      title: 'Where you stand',
      say: 'A tick shows each part that’s done. Leave Google’s code in place after you verify.',
    },

    // ── Go live ──
    {
      id: 'golive', selector: t('site-golive'), when: step('go-live'), title: 'Go live',
      say: 'This is the step that puts your website online.',
      variants: [
        { when: LIVE, title: 'Your website is live', say: 'Your website is live. Anyone can find it now.' },
      ],
    },
    {
      id: 'checklist', selector: t('site-golive-checklist'), title: 'Before you go live',
      say: 'Your pages, phone number and address need to be set first. A logo is nice but optional.',
      variants: [
        {
          when: `${t('site-golive-checklist')}[data-ready="no"]`,
          say: 'A few things are still missing. Fix it next to each one takes you straight there. Your phone and address come from Company info.',
        },
        {
          when: `${t('site-golive-checklist')}[data-ready="yes"]`,
          say: 'Everything you need is ready. A logo is nice but optional.',
        },
      ],
    },
    {
      id: 'golive-actions', selector: t('site-golive-actions'),
      title: 'Look, then switch it on',
      say: 'See it first opens a private preview only you can see. Turn my website on is the only button that makes it public.',
    },
    {
      id: 'offline', selector: t('site-golive-offline'),
      title: 'Take it offline',
      say: 'Need it down for a while? Take my website offline hides it straight away. Nothing is deleted.',
    },

    // ── The next button ──
    {
      id: 'action', selector: t('site-action'), title: 'Next',
      say: 'This button takes you on to the next step.',
      variants: [
        { when: step('look'), title: 'Full Editor', say: 'Happy with the look? Full Editor opens the tools for every word and picture.' },
        { when: `${step('edit')}[data-live="yes"]`, title: 'Done', say: 'Done takes you to the Go live page, where you can preview it or take it offline.' },
        { when: step('edit'), title: 'Put it online', say: 'Put it online takes you to the last step: a quick check, a private preview, then switching it on.' },
      ],
    },
  ],
}
