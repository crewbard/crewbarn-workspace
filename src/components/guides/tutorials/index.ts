import type { TutorialScript } from '../tutorialScript'
import { templatesScript } from './templates'
import { inventoryScript } from './inventory'
import { jobsScript } from './jobs'
import { estimatesScript } from './estimates'
import { contractsScript } from './contracts'
import { invoicesScript } from './invoices'
import { customersScript } from './customers'
import { scheduleScript } from './schedule'
import { businessSetupScript } from './business-setup'
import { teamScript } from './team'
import { workflowScript } from './workflow'
import { catalogScript } from './catalog'
import { dashboardScript } from './dashboard'
import { accountingScript } from './accounting'
import { gettingAroundScript } from './getting-around'
import { welcomeScript } from './welcome'
import { messagesScript } from './messages'

/** Every active tutorial, by id. Loaded only when a tutorial starts. */
export const TUTORIAL_SCRIPTS: Record<string, TutorialScript> = {
  templates: templatesScript,
  inventory: inventoryScript,
  jobs: jobsScript,
  estimates: estimatesScript,
  contracts: contractsScript,
  invoices: invoicesScript,
  customers: customersScript,
  schedule: scheduleScript,
  'business-setup': businessSetupScript,
  team: teamScript,
  workflow: workflowScript,
  catalog: catalogScript,
  dashboard: dashboardScript,
  accounting: accountingScript,
  'getting-around': gettingAroundScript,
  welcome: welcomeScript,
  messages: messagesScript,
}
