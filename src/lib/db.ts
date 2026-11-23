import { createRepositories } from './server/repository';
import { queryTransport } from './server/warehouse';

export const db = createRepositories(statement => queryTransport.execute(statement));
