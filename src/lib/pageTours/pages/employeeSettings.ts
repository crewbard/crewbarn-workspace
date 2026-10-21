import type { PageTour } from '../types'

/**
 * Connect → Team → Employee settings (/tool-shed/employee-settings).
 *
 *   employee-settings-quiet    quiet hours
 *   employee-settings-emails   task reminder emails
 *   employee-settings-duties   where daily duties start
 *
 * Nothing is changed: the tour only looks.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'employee-settings',
  route: '^/tool-shed/employee-settings/?$',
  intro: {
    page: 'Employee settings',
    purpose: 'The defaults for everyone who works here: quiet days and hours, task reminder emails, and how far back daily duties look.',
    covers: ['Quiet hours', 'Task reminder emails', 'Where daily duties start', 'Each person’s own settings'],
  },
  steps: [
    {
      id: 'header', selector: t('employee-settings-header'),
      title: 'Employee settings',
      say: 'These are the company’s defaults. Each person can keep their own quiet hours and task emails on their staff record.',
    },
    {
      id: 'quiet', selector: t('employee-settings-quiet'),
      title: 'Quiet hours',
      say: 'Choose the weekdays and start and end times in your company’s timezone, then press Save quiet hours. Read the saved days and times below it. These reminders wait until quiet hours end; late-tech alerts still go out. A person can have different quiet days and hours on their staff record.',
    },
    {
      id: 'emails', selector: t('employee-settings-emails'),
      title: 'Task reminder emails',
      say: 'Task due soon, task overdue, and the email when someone is given a task. Daily duty to-dos are never emailed: they stay on the Responsibilities board.',
    },
    {
      id: 'duties', selector: t('employee-settings-duties'),
      title: 'Where daily duties start',
      say: 'Duties only make to-dos for records from this date on, so switching them on doesn’t fill everyone’s list with old invoices and estimates. Clear it to look back through everything.',
    },
  ],
}
