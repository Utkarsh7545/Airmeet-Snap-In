import { postCall } from '../utils';

// API endpoint to list all custom schemas
const SCHEMA_LIST = '/internal/schemas.custom.list?is_custom_leaf_type=true&types=tenant_fragment';

const run = async (events: any[]) => {
  console.log('Start Hook...');
  const event = events[0];

  if (event.execution_metadata.event_type === 'hook:snap_in_validate') {
    const inputs = event.input_data.global_values;

    const leafType = (inputs.leaf_type || '').replace(/\s+/g, '_').trim().toLowerCase();
    const fieldKeys = {
      event_name: (inputs.field_event_name || '').trim().toLowerCase(),
      registration_date: (inputs.field_registration_date || '').trim().toLowerCase(),
      account: (inputs.field_account || '').trim().toLowerCase(),
      contact: (inputs.field_contact || '').trim().toLowerCase(),
      other_info: (inputs.field_other_info || '').trim().toLowerCase()
    };

    const token = event.context.secrets.service_account_token;
    const endpoint = event.execution_metadata.devrev_endpoint;

    // Fetch all custom schemas
    const response = await postCall(endpoint + SCHEMA_LIST, token, {});
    console.log('Schema list response:', response);

    if (!response?.success) {
      throw 'Unable to fetch schemas for validation. Please try again later.';
    }

    const schemas = response.data.result || [];

    // Find the matching schema for the provided leaf_type
    const matchingSchema = schemas.find(
      (schema: any) => schema.leaf_type === leafType
    );

    if (!matchingSchema) {
      throw `Invalid leaf_type "${leafType}". No custom schema found with this type.`;
    }

    const schemaFields = matchingSchema.fields || [];

    // Build a list of all display_name strings
    const allowedDisplayNames = schemaFields
      .map((f: any) => f.ui?.display_name?.trim().toLowerCase())
      .filter(Boolean);

    console.log('Allowed field display names:', allowedDisplayNames);

    // Validate each user-provided custom field key
    for (const [key, value] of Object.entries(fieldKeys)) {
      if (!allowedDisplayNames.includes(value)) {
        throw `Invalid field "${value}" for leaf_type "${leafType}". No matching field with this display name in schema.`;
      }
    }

    console.log('Validation successful: All field keys and leaf_type are valid.');
  }
};

export default run;
