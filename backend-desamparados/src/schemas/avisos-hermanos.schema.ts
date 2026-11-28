import { type } from 'arktype';
import { idParam } from '../config/common';

export const conIdSchema = type({ params: { id: idParam } });
