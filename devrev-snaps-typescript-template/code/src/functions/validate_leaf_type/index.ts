import { postCall } from '../utils';

// API endpoints
const SCHEMA_LIST = '/internal/schemas.custom.list?is_custom_leaf_type=true&types=tenant_fragment';
const CUSTOM_LINK_LIST = '/internal/link-types.custom.list';

const run = async (events: any[]) => {
  console.log('Start Hook...');
  const event = events[0];

  if (event.execution_metadata.event_type === 'hook:snap_in_validate') {
    const inputs = event.input_data.global_values;

    const leafType = (inputs.leaf_type_registration || '').replace(/\s+/g, '_').trim().toLowerCase();
    const leafTypeEvent = (inputs.leaf_type_event_creation || '').replace(/\s+/g, '_').trim().toLowerCase();
    const customCreateLinkId = (inputs.custom_create_link_id || '').trim();
    const fieldKeys = {
      event_name: (inputs.field_event_name || '').trim().toLowerCase(),
      registration_date: (inputs.field_registration_date || '').trim().toLowerCase(),
      account: (inputs.field_account || '').trim().toLowerCase(),
      contact: (inputs.field_contact || '').trim().toLowerCase(),
      other_info: (inputs.field_other_info || '').trim().toLowerCase()
    };

    const token = event.context.secrets.service_account_token;
    const endpoint = event.execution_metadata.devrev_endpoint;

    // Step 1: Validate leaf_type
    const schemaResponse = await postCall(endpoint + SCHEMA_LIST, token, {});
    console.log('Schema list response:', schemaResponse);

    if (!schemaResponse?.success) {
      throw 'Unable to fetch schemas for validation. Please try again later.';
    }

    const schemas = schemaResponse.data.result || [];

    const matchingSchema = schemas.find(
      (schema: any) => schema.leaf_type.toLowerCase() === leafType
    );
    console.log("matchingSchema-", matchingSchema);

    const matchingSchemaForEvent = schemas.find(
      (schema: any) => schema.leaf_type.toLowerCase() === leafTypeEvent
    );
    console.log("matchingSchemaForEvent-", matchingSchemaForEvent)

    if (!matchingSchema) {
      throw `Invalid leaf_type "${leafType}". No custom schema found with this type.`;
    }
    
    if (!matchingSchemaForEvent) {
      throw `Invalid leaf_type_event "${leafTypeEvent}". No custom schema found with this type.`;
    }    

    const schemaFields = matchingSchema.fields || [];

    const allowedDisplayNames = schemaFields
      .map((f: any) => f.ui?.display_name?.trim().toLowerCase())
      .filter(Boolean);

    for (const [key, value] of Object.entries(fieldKeys)) {
      if (!allowedDisplayNames.includes(value)) {
        throw `Invalid field "${value}" for leaf_type "${leafType}". No matching field with this display name in schema.`;
      }
    }

    // Step 2: Validate custom_create_link_id by matching with custom link type ID
    const linkListResponse = await postCall(endpoint + CUSTOM_LINK_LIST, token, {});
    console.log('Custom link list response:', linkListResponse);

    if (!linkListResponse?.success) {
      throw 'Unable to fetch custom link types for validation.';
    }

    const allLinks = linkListResponse.data.result || [];

    const matchingLink = allLinks.find(
      (link: any) => (link.id || '').trim() === customCreateLinkId
    );

    if (!matchingLink) {
      throw `Invalid Custom Create Link ID "${customCreateLinkId}". No custom link type found with this ID.`;
    }

    console.log('Validation successful: All field keys, leaf_type, and link ID are valid.');
  }
};

export default run;
