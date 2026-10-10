import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { createIcon } from './createIcon';

// Keep the existing semantic names at call sites while using Font Awesome Free glyphs.
export const AlertCircle = createIcon(faCircleExclamation);
