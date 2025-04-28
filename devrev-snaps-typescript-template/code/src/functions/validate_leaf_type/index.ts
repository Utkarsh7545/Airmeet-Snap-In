import { postCall } from '../utils';

// API endpoint to list all custom schemas
const SCHEMA_LIST = '/internal/schemas.custom.list?is_custom_leaf_type=true&prune=fields&types=tenant_fragment';

// Main function to run during snap-in validation
const run = async (events: any[]) => {
  console.log("Start Hook...");
  const event = events[0];

  // Only handle validation event during snap-in update or activation
  if (event.execution_metadata.event_type === 'hook:snap_in_validate') {
    // Normalize the provided leaf_type: remove extra spaces, convert to lower case
    const leafType = (event.input_data.global_values.leaf_type || '').replace(/\s+/g, '_').trim().toLowerCase();

    const token = event.context.secrets.service_account_token;
    const endpoint = event.execution_metadata.devrev_endpoint;

    // Fetch the list of all available custom schemas
    const response = await postCall(endpoint + SCHEMA_LIST, token, {});
    console.log("response- ", response);

    // If API call failed, throw an error to prevent invalid snap-in activation
    if (!response?.success) {
      throw 'Unable to fetch schemas for validation. Please try again later.';
    }

    // Extract all leaf types from the fetched schema list
    const allLeafTypes = response.data.result?.map((schema: any) => schema.leaf_type) || [];
    console.log("allLeafTypes- ", allLeafTypes);

    // Validate if provided leafType exists in the available schemas
    if (!allLeafTypes.includes(leafType)) {
      throw `Invalid leaf_type "${leafType}". No custom schema found with this type. Please check your configuration.`;
    }
  }
};

export default run;
