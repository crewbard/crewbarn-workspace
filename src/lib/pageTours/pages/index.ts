import type { PageTour } from '../types'
import { PAGE_TOUR as CUSTOMER_APP } from './customerApp'
import { PAGE_TOUR as KEYBOARD_SHORTCUTS } from './keyboardShortcuts'
import { PAGE_TOUR as CONNECT_HOME } from './connectHome'
import { PAGE_TOUR as AREA_BUSINESS } from './areaBusiness'
import { PAGE_TOUR as COMPANY_INFO } from './companyInfo'
import { PAGE_TOUR as BRAND } from './brand'
import { PAGE_TOUR as SETTINGS_LOCATION } from './settingsLocation'
import { PAGE_TOUR as WEBSITE } from './website'
import { PAGE_TOUR as GOOGLE_REVIEWS } from './googleReviews'
import { PAGE_TOUR as MARKETPLACE } from './marketplace'
import { PAGE_TOUR as MODULES } from './modules'
import { PAGE_TOUR as AREA_ACCOUNT } from './areaAccount'
import { PAGE_TOUR as SUBSCRIPTION } from './subscription'
import { PAGE_TOUR as USAGE } from './usage'
import { PAGE_TOUR as IMPORT_DATA } from './importData'
import { PAGE_TOUR as DATA_EXPORT } from './dataExport'
import { PAGE_TOUR as ENCRYPTION } from './encryption'
import { PAGE_TOUR as COMPANY_FILES } from './companyFiles'
import { PAGE_TOUR as AUDIT_LOG } from './auditLog'
import { PAGE_TOUR as GUIDED_SETUP } from './guidedSetup'
import { PAGE_TOUR as FRANCHISE_ACCESS } from './franchiseAccess'
import { PAGE_TOUR as AREA_CUSTOMERS } from './areaCustomers'
import { PAGE_TOUR as CUSTOMER_TYPES } from './customerTypes'
import { PAGE_TOUR as TAGS } from './tags'
import { PAGE_TOUR as SERVICE_LOCATIONS } from './serviceLocations'
import { PAGE_TOUR as TERRITORIES } from './territories'
import { PAGE_TOUR as ASSET_TYPES } from './assetTypes'
import { PAGE_TOUR as ASSET_ACCESS_REQUESTS } from './assetAccessRequests'
import { PAGE_TOUR as SERVICE_AGREEMENTS } from './serviceAgreements'
import { PAGE_TOUR as CONTRACT_INVOICES } from './settingContractInvoices'
import { PAGE_TOUR as AREA_WORKFLOW } from './areaWorkflow'
import { PAGE_TOUR as JOB_TYPES } from './jobTypes'
import { PAGE_TOUR as JOB_STATUSES } from './jobStatuses'
import { PAGE_TOUR as SHOP_RULES_INTAKE } from './shopRulesIntake'
import { PAGE_TOUR as SHOP_RULES_NUMBERING } from './shopRulesNumbering'
import { PAGE_TOUR as CUSTOM_FIELDS } from './customFields'
import { PAGE_TOUR as AUTO_CHECK_IN } from './settingAutoCheckIn'
import { PAGE_TOUR as LATE_TECHS } from './settingLateTechs'
import { PAGE_TOUR as STALLED_JOBS } from './settingStalledJobs'
import { PAGE_TOUR as SHOP_RULES_FIELD_RULES } from './shopRulesFieldRules'
import { PAGE_TOUR as VIDEO_LENGTH } from './settingVideoLength'
import { PAGE_TOUR as AUTOMATIONS } from './automations'
import { PAGE_TOUR as JOB_REMINDERS } from './settingJobReminders'
import { PAGE_TOUR as TEMPLATES } from './templates'
import { PAGE_TOUR as WARRANTY_SETTINGS } from './warrantySettings'
import { PAGE_TOUR as WARRANTY_EXPIRING } from './settingWarrantyExpiring'
import { PAGE_TOUR as AUTOMATION_BUILD } from './automationBuild'
import { PAGE_TOUR as REMINDER_TIMELINE } from './reminderTimeline'
import { PAGE_TOUR as FORM_BUILDER } from './formBuilder'
import { PAGE_TOUR as AREA_TEAM } from './areaTeam'
import { PAGE_TOUR as STAFF } from './staff'
import { PAGE_TOUR as SUBCONTRACTORS } from './subcontractors'
import { PAGE_TOUR as HIRING } from './hiring'
import { PAGE_TOUR as ROLES } from './roles'
import { PAGE_TOUR as SHOP_RULES_DELETE_PERMISSIONS } from './shopRulesDeletePermissions'
import { PAGE_TOUR as SECURITY } from './security'
import { PAGE_TOUR as TIME_OFF } from './timeOff'
import { PAGE_TOUR as RESPONSIBILITIES } from './responsibilities'
import { PAGE_TOUR as CALL_SCRIPTS } from './callScripts'
import { PAGE_TOUR as EMPLOYEE_SETTINGS } from './employeeSettings'
import { PAGE_TOUR as SHOP_RULES_PAY } from './shopRulesPay'
import { PAGE_TOUR as SHOP_RULES_VACATION } from './shopRulesVacation'
import { PAGE_TOUR as SHOP_RULES_CLOCK } from './shopRulesClock'
import { PAGE_TOUR as COMPANY_ASSETS } from './companyAssets'
import { PAGE_TOUR as GPS_DEVICES } from './gpsDevices'
import { PAGE_TOUR as AREA_AI } from './areaAi'
import { PAGE_TOUR as AI_PROVIDER } from './aiProvider'
import { PAGE_TOUR as AI_KEY } from './aiKey'
import { PAGE_TOUR as AI_VOICE } from './aiVoice'
import { PAGE_TOUR as AI_ALLOWED } from './aiAllowed'
import { PAGE_TOUR as AI_LEARNING } from './aiLearning'
import { PAGE_TOUR as AI_MEMORY } from './aiMemory'
import { PAGE_TOUR as AI_RULES } from './aiRules'
import { PAGE_TOUR as AI_ACTIVITY } from './aiActivity'
import { PAGE_TOUR as CBI_AI } from './cbiAi'
import { PAGE_TOUR as AREA_CONNECTIONS } from './areaConnections'
import { PAGE_TOUR as COMMUNICATION } from './communication'
import { PAGE_TOUR as TWILIO_TEXTING } from './twilioTexting'
import { PAGE_TOUR as CALL_TRANSCRIPTION } from './callTranscription'
import { PAGE_TOUR as EMAIL_SENDER } from './emailSender'
import { PAGE_TOUR as SHOP_RULES_SENDER } from './shopRulesSender'
import { PAGE_TOUR as INTEGRATIONS } from './integrations'
import { PAGE_TOUR as CONNECTED_APPS } from './connectedApps'
import { PAGE_TOUR as PARTNER_CONNECTIONS } from './partnerConnections'
import { PAGE_TOUR as STORAGE_MAPS } from './storageMaps'
import { PAGE_TOUR as CLOUDFLARE } from './cloudflare'
import { PAGE_TOUR as SHOP_TV } from './shopTv'
import { PAGE_TOUR as TWILIO_SETUP } from './twilioSetup'
import { PAGE_TOUR as AREA_DEVELOPERS } from './areaDevelopers'
import { PAGE_TOUR as API_TOKENS } from './apiTokens'
import { PAGE_TOUR as API_ENDPOINTS } from './apiEndpoints'
import { PAGE_TOUR as WEBHOOKS } from './webhooks'
import { PAGE_TOUR as SELF_HOSTED } from './selfHosted'
import { PAGE_TOUR as MESSAGES } from './messages'
import { PAGE_TOUR as CALLS } from './calls'
import { PAGE_TOUR as INTAKE } from './intake'
import { PAGE_TOUR as CONNECT_CATALOG } from './connectCatalog'
import { PAGE_TOUR as SERVICE_CATALOG } from './serviceCatalog'
import { PAGE_TOUR as PRODUCT_CATALOG } from './productCatalog'
import { PAGE_TOUR as SERVICE_CATEGORIES } from './serviceCategories'
import { PAGE_TOUR as PRODUCT_CATEGORIES } from './productCategories'
import { PAGE_TOUR as REFERENCE_CARDS } from './referenceCards'
import { PAGE_TOUR as CATALOGS } from './catalogs'
import { PAGE_TOUR as INVENTORY } from './inventory'
import { PAGE_TOUR as VENDORS } from './vendors'
import { PAGE_TOUR as LABEL_PRINTER } from './labelPrinter'
import { PAGE_TOUR as PURCHASE_ORDERS } from './purchaseOrders'
import { PAGE_TOUR as NEEDS_ORDERED } from './needsOrdered'
import { PAGE_TOUR as ORDER_PARTS } from './orderParts'
import { PAGE_TOUR as PURCHASE_ORDER_NEW } from './purchaseOrderNew'
import { PAGE_TOUR as PURCHASE_ORDER_DETAIL } from './purchaseOrderDetail'
import { PAGE_TOUR as CONNECT_MONEY } from './connectMoney'
import { PAGE_TOUR as PAYMENTS } from './payments'
import { PAGE_TOUR as CARD_PROCESSOR } from './cardProcessor'
import { PAGE_TOUR as BANK_TRANSFER } from './bankTransfer'
import { PAGE_TOUR as WATCH_BANK } from './watchBank'
import { PAGE_TOUR as PAYMENT_TYPES } from './paymentTypes'
import { PAGE_TOUR as PAYMENT_TERMS } from './paymentTerms'
import { PAGE_TOUR as TAX_CLASSES } from './taxClasses'
import { PAGE_TOUR as PRICING } from './pricing'
import { PAGE_TOUR as COST_MODEL } from './costModel'
import { PAGE_TOUR as CASH_COLLECTION } from './cashCollection'
import { PAGE_TOUR as MONEY_DESK } from './moneyDesk'
import { PAGE_TOUR as ACCOUNTING_OVERVIEW } from './accountingOverview'
import { PAGE_TOUR as INVOICES } from './invoices'
import { PAGE_TOUR as INVOICE_DETAIL } from './invoiceDetail'
import { PAGE_TOUR as CASH_REGISTER } from './cashRegister'
import { PAGE_TOUR as CASH_DRAWER_CLASSIC } from './cashDrawerClassic'
import { PAGE_TOUR as CUSTOMER_CREDITS } from './customerCredits'
import { PAGE_TOUR as CARD_TRANSACTIONS } from './cardTransactions'
import { PAGE_TOUR as EXPENSES } from './expenses'
import { PAGE_TOUR as EXPENSE_REGISTER } from './expenseRegister'
import { PAGE_TOUR as VENDOR_BILLS } from './vendorBills'
import { PAGE_TOUR as PAYROLL } from './payroll'
import { PAGE_TOUR as PAYROLL_PROFILES } from './payrollProfiles'
import { PAGE_TOUR as INVENTORY_COST } from './inventoryCost'
import { PAGE_TOUR as SUB_PAYOUTS } from './subPayouts'
import { PAGE_TOUR as BANK_MATCH } from './bankMatch'
import { PAGE_TOUR as BANK_MATCH_REVIEW } from './bankMatchReview'
import { PAGE_TOUR as LEDGER } from './ledger'
import { PAGE_TOUR as SALES_TAX } from './salesTax'
import { PAGE_TOUR as SYNC_MAPPINGS } from './syncMappings'
import { PAGE_TOUR as REPORTS } from './reports'
import { PAGE_TOUR as REPORTS_BROWSE } from './reportsBrowse'
import { PAGE_TOUR as DASHBOARD } from './dashboard'
import { PAGE_TOUR as SCHEDULE } from './schedule'
import { PAGE_TOUR as DISPATCH } from './dispatch'
import { PAGE_TOUR as FIELD_REVIEW } from './fieldReview'
import { PAGE_TOUR as ROUTE_HISTORY } from './routeHistory'
import { PAGE_TOUR as ESTIMATES } from './estimates'
import { PAGE_TOUR as ESTIMATE_NEW } from './estimateNew'
import { PAGE_TOUR as ESTIMATE_DETAIL } from './estimateDetail'
import { PAGE_TOUR as CONTRACTS } from './contracts'
import { PAGE_TOUR as CONTRACT_NEW } from './contractNew'
import { PAGE_TOUR as CONTRACT_DETAIL } from './contractDetail'
import { PAGE_TOUR as ASSETS } from './assets'
import { PAGE_TOUR as TASKS } from './tasks'
import { PAGE_TOUR as WARRANTIES } from './warranties'
import { PAGE_TOUR as SUB_REVIEWS } from './subReviews'
import { PAGE_TOUR as INBOUND_SUB_JOBS } from './inboundSubJobs'
import { PAGE_TOUR as CUSTOMERS_LIST } from './customersList'
import { PAGE_TOUR as CUSTOMER_NEW } from './customerNew'
import { PAGE_TOUR as CUSTOMER_DETAIL } from './customerDetail'
import { PAGE_TOUR as JOBS_LIST } from './jobsList'
import { PAGE_TOUR as JOB_NEW } from './jobNew'
import { PAGE_TOUR as JOB_DETAIL } from './jobDetail'

/**
 * Every page tour written for one page. Add a file in this folder that
 * exports `PAGE_TOUR`, and list it here. A page without one still gets a
 * tour: its area tutorial's steps for the page, or its guided tour, after an
 * intro made from the Connect menu (src/lib/pageTours/build.ts).
 */
export const PAGE_TOURS: PageTour[] = [
  CUSTOMER_APP,
  CONNECT_HOME,
  AREA_BUSINESS,
  COMPANY_INFO,
  BRAND,
  SETTINGS_LOCATION,
  WEBSITE,
  GOOGLE_REVIEWS,
  MARKETPLACE,
  MODULES,
  AREA_ACCOUNT,
  SUBSCRIPTION,
  USAGE,
  IMPORT_DATA,
  DATA_EXPORT,
  ENCRYPTION,
  COMPANY_FILES,
  AUDIT_LOG,
  GUIDED_SETUP,
  FRANCHISE_ACCESS,
  AREA_CUSTOMERS,
  CUSTOMER_TYPES,
  TAGS,
  SERVICE_LOCATIONS,
  TERRITORIES,
  ASSET_TYPES,
  ASSET_ACCESS_REQUESTS,
  SERVICE_AGREEMENTS,
  CONTRACT_INVOICES,
  AREA_WORKFLOW,
  JOB_TYPES,
  JOB_STATUSES,
  SHOP_RULES_INTAKE,
  SHOP_RULES_NUMBERING,
  CUSTOM_FIELDS,
  AUTO_CHECK_IN,
  LATE_TECHS,
  STALLED_JOBS,
  SHOP_RULES_FIELD_RULES,
  VIDEO_LENGTH,
  AUTOMATIONS,
  JOB_REMINDERS,
  TEMPLATES,
  WARRANTY_SETTINGS,
  WARRANTY_EXPIRING,
  AUTOMATION_BUILD,
  REMINDER_TIMELINE,
  FORM_BUILDER,
  AREA_TEAM,
  STAFF,
  SUBCONTRACTORS,
  HIRING,
  ROLES,
  SHOP_RULES_DELETE_PERMISSIONS,
  SECURITY,
  TIME_OFF,
  RESPONSIBILITIES,
  CALL_SCRIPTS,
  EMPLOYEE_SETTINGS,
  SHOP_RULES_PAY,
  SHOP_RULES_VACATION,
  SHOP_RULES_CLOCK,
  COMPANY_ASSETS,
  GPS_DEVICES,
  AREA_AI,
  AI_PROVIDER,
  AI_KEY,
  AI_VOICE,
  AI_ALLOWED,
  AI_LEARNING,
  AI_MEMORY,
  AI_RULES,
  AI_ACTIVITY,
  CBI_AI,
  AREA_CONNECTIONS,
  COMMUNICATION,
  TWILIO_TEXTING,
  CALL_TRANSCRIPTION,
  EMAIL_SENDER,
  SHOP_RULES_SENDER,
  INTEGRATIONS,
  CONNECTED_APPS,
  PARTNER_CONNECTIONS,
  STORAGE_MAPS,
  CLOUDFLARE,
  SHOP_TV,
  TWILIO_SETUP,
  AREA_DEVELOPERS,
  API_TOKENS,
  API_ENDPOINTS,
  WEBHOOKS,
  SELF_HOSTED,
  MESSAGES,
  CALLS,
  INTAKE,
  CONNECT_CATALOG,
  SERVICE_CATALOG,
  PRODUCT_CATALOG,
  SERVICE_CATEGORIES,
  PRODUCT_CATEGORIES,
  REFERENCE_CARDS,
  CATALOGS,
  INVENTORY,
  VENDORS,
  LABEL_PRINTER,
  PURCHASE_ORDERS,
  NEEDS_ORDERED,
  ORDER_PARTS,
  PURCHASE_ORDER_NEW,
  PURCHASE_ORDER_DETAIL,
  CONNECT_MONEY,
  PAYMENTS,
  CARD_PROCESSOR,
  BANK_TRANSFER,
  WATCH_BANK,
  PAYMENT_TYPES,
  PAYMENT_TERMS,
  TAX_CLASSES,
  PRICING,
  COST_MODEL,
  CASH_COLLECTION,
  MONEY_DESK,
  ACCOUNTING_OVERVIEW,
  INVOICES,
  INVOICE_DETAIL,
  CASH_REGISTER,
  CASH_DRAWER_CLASSIC,
  CUSTOMER_CREDITS,
  CARD_TRANSACTIONS,
  EXPENSES,
  EXPENSE_REGISTER,
  VENDOR_BILLS,
  PAYROLL,
  PAYROLL_PROFILES,
  INVENTORY_COST,
  SUB_PAYOUTS,
  BANK_MATCH,
  BANK_MATCH_REVIEW,
  LEDGER,
  SALES_TAX,
  SYNC_MAPPINGS,
  REPORTS,
  REPORTS_BROWSE,
  DASHBOARD,
  SCHEDULE,
  DISPATCH,
  FIELD_REVIEW,
  ROUTE_HISTORY,
  ESTIMATES,
  ESTIMATE_NEW,
  ESTIMATE_DETAIL,
  CONTRACTS,
  CONTRACT_NEW,
  CONTRACT_DETAIL,
  ASSETS,
  TASKS,
  WARRANTIES,
  SUB_REVIEWS,
  INBOUND_SUB_JOBS,
  CUSTOMERS_LIST,
  CUSTOMER_NEW,
  CUSTOMER_DETAIL,
  JOBS_LIST,
  JOB_NEW,
  JOB_DETAIL,
  KEYBOARD_SHORTCUTS,
]
