/**
 * Communication settings — backed by communication-related columns on
 * tenant_settings. BYO-API: each tenant configures their own provider
 * credentials (Email SMTP, Twilio SMS, net2phone SMS).
 *
 * Sensitive credentials (passwords, tokens, secrets) are NEVER returned
 * in responses. Instead, "_present" boolean siblings tell the frontend
 * whether each is set, so the UI can render placeholder bullets or empty
 * inputs as appropriate.
 *
 * GET   /v1/settings/communication
 * PATCH /v1/settings/communication
 */

export type SmtpEncryption = 'tls' | 'ssl' | 'none'
export type CommsProvider = 'none' | 'twilio_hosted' | 'twilio_byo' | 'net2phone'
export type Net2PhoneIntakeWorkflow =
  | 'locksmith_vehicle_key'
  | 'hvac_equipment'
  | 'general_service'
  | 'automotive_dealer'

export interface CommunicationSettings {
  // === Email (SMTP) ===
  email_smtp_host: string | null
  email_smtp_port: number | null
  email_smtp_username_present: boolean
  email_smtp_password_present: boolean
  email_smtp_encryption: SmtpEncryption | null
  email_from_address: string | null
  email_reply_to_address: string | null
  email_from_name: string | null

  // === Twilio (SMS) ===
  comms_provider: CommsProvider | null
  twilio_enabled: boolean
  twilio_account_sid_present: boolean
  twilio_auth_token_present: boolean
  twilio_from_number: string | null
  twilio_voice_api_key_sid_present: boolean
  twilio_voice_api_key_secret_present: boolean
  twilio_voice_twiml_app_sid: string | null
  twilio_voice_twiml_url: string | null
  mobile_twilio_ready: boolean

  // === net2phone (SMS, OAuth2 client credentials) ===
  net2phone_enabled: boolean
  net2phone_client_id_present: boolean
  net2phone_client_secret_present: boolean
  net2phone_from_number: string | null
  net2phone_access_token_present: boolean
  net2phone_refresh_token_present: boolean
  net2phone_api_key_present: boolean
  net2phone_webhook_secret_present: boolean
  net2phone_enforce_webhook_signature: boolean
  net2phone_callback_url: string | null
  /** A per-workspace secret rides in the callback URL; the bare URL is refused. */
  net2phone_require_webhook_key: boolean
  net2phone_intake_enabled: boolean
  /** Keep job-linked threads in the Messages inbox instead of moving them onto the job. */
  comms_inbox_keeps_linked_threads: boolean
  net2phone_intake_label: string | null
  net2phone_intake_number: string | null
  net2phone_intake_api_key_present: boolean
  net2phone_intake_webhook_secret_present: boolean
  net2phone_intake_workflow: Net2PhoneIntakeWorkflow | null
  net2phone_intake_callback_url: string | null

  // === Telnyx (planned BYO provider; not active until adapter is live) ===
  telnyx_enabled: boolean
  telnyx_api_key_present: boolean
  telnyx_from_number: string | null
  telnyx_messaging_profile_id: string | null
  telnyx_connection_id: string | null
  telnyx_webhook_public_key_present: boolean

  // Call transcription
  transcription_openai_api_key_present: boolean
  transcription_provider?: 'openai' | 'assemblyai'
  transcription_assemblyai_api_key_present?: boolean
}

/**
 * PATCH body — partial updates allowed. Sensitive fields ARE writable
 * here (the actual plaintext credential the user types). The server
 * encrypts and stores; subsequent reads only return the _present boolean.
 *
 * Convention: omit a field to leave it unchanged. Send empty string or
 * null to clear it.
 */
export interface CommunicationSettingsUpdate {
  // Email (SMTP)
  email_smtp_host?: string | null
  email_smtp_port?: number | null
  email_smtp_username?: string | null
  email_smtp_password?: string | null
  email_smtp_encryption?: SmtpEncryption | null
  email_from_address?: string | null
  email_reply_to_address?: string | null
  email_from_name?: string | null

  // Twilio
  comms_provider?: CommsProvider | null
  twilio_enabled?: boolean
  twilio_account_sid?: string | null
  twilio_auth_token?: string | null
  twilio_from_number?: string | null
  twilio_voice_api_key_sid?: string | null
  twilio_voice_api_key_secret?: string | null
  twilio_voice_twiml_app_sid?: string | null

  // net2phone
  net2phone_enabled?: boolean
  net2phone_client_id?: string | null
  net2phone_client_secret?: string | null
  net2phone_from_number?: string | null
  net2phone_access_token?: string | null
  net2phone_refresh_token?: string | null
  net2phone_api_key?: string | null
  net2phone_webhook_secret?: string | null
  net2phone_enforce_webhook_signature?: boolean
  net2phone_require_webhook_key?: boolean
  net2phone_intake_enabled?: boolean
  comms_inbox_keeps_linked_threads?: boolean
  net2phone_intake_label?: string | null
  net2phone_intake_number?: string | null
  net2phone_intake_api_key?: string | null
  net2phone_intake_webhook_secret?: string | null
  net2phone_intake_workflow?: Net2PhoneIntakeWorkflow | null

  // Telnyx planned BYO provider
  telnyx_enabled?: boolean
  telnyx_api_key?: string | null
  telnyx_from_number?: string | null
  telnyx_messaging_profile_id?: string | null
  telnyx_connection_id?: string | null
  telnyx_webhook_public_key?: string | null

  // Call transcription
  transcription_openai_api_key?: string | null
  transcription_provider?: 'openai' | 'assemblyai'
  transcription_assemblyai_api_key?: string | null
}

export interface CommunicationSettingsResponse {
  data: CommunicationSettings
}
