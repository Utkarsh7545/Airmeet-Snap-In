import { postCall } from '../utils';

// Constants
const CREATE_CUSTOM_OBJECT = '/internal/custom-objects.create';

// Utility class for DevRev API interactions specific to Airmeet events
class EventApiUtils {
  private token: string;
  private endpoint: string;

  constructor(endpoint: string, token: string) {
    this.token = token;
    this.endpoint = endpoint;
  }

  // Create custom object in DevRev for newly created Airmeet event
  async createCustomObjectForEvent(eventCreated: any, leafTypeEvent: string): Promise<any> {
    const enrichedPayload = {
      leaf_type: leafTypeEvent,
      unique_key: `${eventCreated.id}`,
      custom_fields: {
        tnt__name: eventCreated.name,
        tnt__start_time: eventCreated.start_time + ' ' + eventCreated.timezone,
        tnt__end_time: eventCreated.end_time + ' ' + eventCreated.timezone,
        tnt__long_description: eventCreated.long_desc,
        tnt__other_info: JSON.stringify({
          airmeetId: eventCreated.airmeet_id,
          organiserName: eventCreated.organiser_name,
          organiserEmail: eventCreated.organiser_email,
          organiserUrl: eventCreated.organiser_url,
          organiserIntro: eventCreated.organiser_intro,
        }),
        tnt__timezone: eventCreated.timezone,
      },
      custom_schema_spec: {
        tenant_fragment: true,
        validate_required_fields: true,
      },
    };

    const response = await postCall(this.endpoint + CREATE_CUSTOM_OBJECT, this.token, enrichedPayload);
    console.log("createCustomObjectForEvent-", response);
    return response.success ? response.data?.custom_object : null;
  }
}

// Main function handler for Airmeet event creation webhook
export const handle_airmeet_event_created = async (event: any) => {
  const endpoint = event.execution_metadata.devrev_endpoint;
  const token = event.context.secrets.service_account_token;
  const eventApi = new EventApiUtils(endpoint, token);
  const eventCreated = event.payload;
  const leafTypeEvent = (event.input_data.global_values.leaf_type_event_creation || '').replace(/\s+/g, '_').trim().toLowerCase();

  if (!eventCreated || !eventCreated.id || !eventCreated.name) {
    return { success: false, error: 'Missing event data from Airmeet' };
  }

  try {
    console.log('Creating new custom object for event...');
    const result = await eventApi.createCustomObjectForEvent(eventCreated, leafTypeEvent);
    if (result) {
      return { success: true, custom_object_id: result.id };
    } else {
      return { success: false, error: 'Failed to create custom object for event' };
    }
  } catch (err) {
    console.error('Error processing Airmeet event creation:', err);
    return { success: false, error: 'Exception during processing' };
  }
};

// Main function that processes all incoming events
export const run = async (events: any[]) => {
  for (const event of events) {
    console.log('Event-', event);
    await handle_airmeet_event_created(event);
  }
};

export default run;
