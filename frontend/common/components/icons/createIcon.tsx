import { type IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { AppIconComponent } from '../../types/AppIconComponent';

export const createIcon = (icon: IconDefinition): AppIconComponent => {
  return (props) => <FontAwesomeIcon icon={icon} {...props} />;
};
