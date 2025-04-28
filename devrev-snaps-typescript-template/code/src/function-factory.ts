import handle_airmeet_webhook from './functions/handle_airmeet_webhook';
import validate_leaf_type from './functions/validate_leaf_type'

export const functionFactory = {
  // Add your functions here
  handle_airmeet_webhook,
  validate_leaf_type,
} as const;

export type FunctionFactoryType = keyof typeof functionFactory;
