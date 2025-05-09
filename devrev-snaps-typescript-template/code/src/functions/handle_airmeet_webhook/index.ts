import { postCall } from '../utils';

// API Endpoints used for various DevRev internal operations
const CREATE_CUSTOM_OBJECT = '/internal/custom-objects.create';
const ACCOUNTS_CREATE = '/internal/accounts.create';
const ACCOUNTS_LIST = '/internal/accounts.list';
const REV_USERS_CREATE = '/internal/rev-users.create';
const REV_USERS_LIST = '/internal/rev-users.list';
const CUSTOM_OBJECT_LIST = '/internal/custom-objects.list';
const CREATE_LINK = '/internal/links.create';

// API Utility class to manage Accounts, Contacts, and Custom Objects
class ApiUtils {
  private token: string;
  private endpoint: string;

  constructor(endpoint: string, token: string) {
    this.token = token;
    this.endpoint = endpoint;
  }

  // Fetch account info based on domain
  async getAccountInfo(domain: string): Promise<any[]> {
    try {
      console.log(`Finding account by domain: ${domain}`);
      const response = await postCall(this.endpoint + ACCOUNTS_LIST, this.token, { domains: [domain] });
      console.log("getAccountInfo-", response);

      if (!response.success) {
        console.error(`Error finding account: ${response.errMessage}`);
        return [];
      }

      const accounts = response.data?.accounts || [];
      return accounts;
    } catch (error) {
      console.error(`Error finding account by domain ${domain}:`, error);
      return [];
    }
  }

  // Create a new account if it does not exist
  async createAccount(domain: string, accPayload: any): Promise<any> {
    const payload = {
      ...accPayload,
      display_name: domain,
      domains: [domain],
      external_refs: [domain],
    };
    try {
      const response = await postCall(this.endpoint + ACCOUNTS_CREATE, this.token, payload);
      console.log("createAccount-", response);
      return response.data?.account;
    } catch (e) {
      console.error('Error creating account:', e);
      return undefined;
    }
  }

  // Fetch contact info based on email
  async getContactInfo(email: string): Promise<any[]> {
    try {
      const result = await postCall(this.endpoint + REV_USERS_LIST, this.token, { email: [email] });
      console.log("getContactInfo-", result);
      return result.data?.rev_users || [];
    } catch (e) {
      console.error('Error retrieving contact info:', e);
      return [];
    }
  }

  // Create a new contact if it does not exist
  async createContact(email: string, contactPayload: any, accountId?: string): Promise<any> {
    const payload = {
      ...contactPayload,
      email: email,
      external_ref: email,
      account: accountId,
    };
    try {
      const response = await postCall(this.endpoint + REV_USERS_CREATE, this.token, payload);
      console.log("createContact-", response);
      return response.data?.rev_user;
    } catch (e) {
      console.error('Error creating contact:', e);
      return undefined;
    }
  }

  // Create a custom object (engagement) based on registrant info
  async createCustomObject(registrant: any, leafType: any, account: any, contact: any): Promise<any> {
    const formatDate = (isoDate: string) => {
      return new Date(isoDate).toISOString().split('T')[0];
    };

    const enrichedPayload = {
      leaf_type: leafType,
      unique_key: `${registrant.id}`,
      custom_fields: {
        tnt__event_name: registrant.airmeetName,
        tnt__registration_date: formatDate(registrant.registrationTime),
        tnt__account: account?.id,
        tnt__contact: contact?.id,
        tnt__other_info: JSON.stringify(registrant),
      },
      custom_schema_spec: {
        tenant_fragment: true,
        validate_required_fields: true,
      },
    };

    const response = await postCall(this.endpoint + CREATE_CUSTOM_OBJECT, this.token, enrichedPayload);
    console.log("createCustomObject-", response);
    return response.success ? response.data?.custom_object : null;
  }

  // Logic to match airmeetId from stringified tnt__other_info
  async findEventCustomObjectByAirmeetId(airmeetId: string, leafTypeEvent: string): Promise<any> {
    const payload = { leaf_type: leafTypeEvent };
    const response = await postCall(this.endpoint + CUSTOM_OBJECT_LIST, this.token, payload);

    if (!response.success || !response.data?.result) return null;

    for (const obj of response.data.result) {
      const otherInfoStr = obj.custom_fields?.tnt__other_info;
      if (!otherInfoStr) continue;

      try {
        const otherInfo = JSON.parse(otherInfoStr);
        console.log("findEventCustomObjectByAirmeetId-", otherInfo);
        if (otherInfo.airmeetId === airmeetId) return obj;
      } catch (e) {
        console.warn('Error parsing tnt__other_info:', e);
      }
    }

    return null;
  }

  // Method to create a link between two custom objects
  async linkUserToEvent(customCreateLinkId: string, userObjId: string, eventObjId: string): Promise<void> {
    const payload = {
      custom_link_type: customCreateLinkId,
      link_type: "custom_link",
      source: userObjId,
      target: eventObjId
    };

    try {
      const response = await postCall(this.endpoint + CREATE_LINK, this.token, payload);
      console.log("linkUserToEvent-", response);
      if (!response.success) {
        console.error('Link creation failed:', response.errMessage);
      } else {
        console.log('Link created successfully');
      }
    } catch (e) {
      console.error('Error linking user to event:', e);
    }
  }
}

// Airmeet utility functions to help with domain extraction and formatting
class AirmeetUtils {
  static extractDomain(email: string): string {
    return email.split('@')[1].toLowerCase();
  }

  static formatDisplayName(name: string | undefined): string {
    if (!name) return 'Airmeet Attendee';

    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    console.log(`Name- ${parts[0]} ${parts[parts.length - 1]}`);
    return `${parts[0]} ${parts[parts.length - 1]}`;
  }

  static isGenericDomain(domain: string): boolean {
    return ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'].includes(domain);
  }
}

// Event handler to process each incoming Airmeet registration
export const handleEvent = async (event: any) => {
  const endpoint = event.execution_metadata.devrev_endpoint;
  const token = event.context.secrets.service_account_token;
  const apiUtil = new ApiUtils(endpoint, token);
  const inputs = event.input_data.global_values;
  const registrant = event.payload;
  const leafType = (inputs.leaf_type_registration || '').replace(/\s+/g, '_').trim().toLowerCase();
  const leafTypeEvent = (inputs.leaf_type_event_creation || '').replace(/\s+/g, '_').trim().toLowerCase();
  const customCreateLinkId = (inputs.custom_create_link_id || '').trim();

  if (!registrant || !registrant.email) {
    return { success: false, error: 'Missing registrant data' };
  }

  const email = registrant.email;
  const name = AirmeetUtils.formatDisplayName(registrant.name);
  const domain = AirmeetUtils.extractDomain(email);
  const shouldLinkAccounts = inputs['opt_in_account_linking'];
  const isGeneric = AirmeetUtils.isGenericDomain(domain);

  let accountId: string | undefined;
  let account: any;

  // Find or create account if domain is not generic
  if (shouldLinkAccounts && !isGeneric) {
    console.log('Searching for existing accounts...');
    const existingAccounts = await apiUtil.getAccountInfo(domain);
    console.log('Existing accounts-', existingAccounts);

    account = existingAccounts[0];
    accountId = account?.id;

    if (!accountId) {
      account = await apiUtil.createAccount(domain, {});
      accountId = account?.id;
    }
  }
  console.log('Final accountId-', accountId);

  let contactId: string | undefined;
  let contact: any;

  // Find or create contact
  const existingContacts = await apiUtil.getContactInfo(email);

  if (existingContacts.length === 0) {
    contact = await apiUtil.createContact(email, { display_name: name }, accountId);
    contactId = contact?.id;
  } else {
    contact = existingContacts[0];
    contactId = contact.id;
  }
  console.log('Final contactId-', contactId);

  // Create custom object if contact is successfully created
  if (contactId) {
    console.log('Creating new custom engagement...');
    const userObj = await apiUtil.createCustomObject(registrant, leafType, account, contact);

    if (userObj?.id && registrant.airmeetId) {
      const eventObj = await apiUtil.findEventCustomObjectByAirmeetId(registrant.airmeetId, leafTypeEvent);
      if (eventObj?.id) {
        await apiUtil.linkUserToEvent(customCreateLinkId, userObj.id, eventObj.id);
      }
    }
  }

  return { success: true };
};

// Main function that processes all incoming events
export const run = async (events: any[]) => {
  for (const event of events) {
    console.log('Event-', event);
    await handleEvent(event);
  }
};

export default run;
