import { useLocalStorage } from './useLocalStorage';
import { MOBILE_QUERY, useMediaQuery } from './useMediaQuery';

export type Orientation = 'vertical' | 'horizontal';

/**
 * On a phone the board is rotated so the pitch width fills the screen (attack runs left → right).
 * Players can flip it back to the normal landscape picture; the choice is remembered per device
 * and shared by every tab. On a wide screen the board is always landscape.
 */
export function useBoardOrientation() {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [orientation, setOrientation] = useLocalStorage<Orientation>('steamrollers.board-orientation', 'vertical');
  return { mobile, orientation, setOrientation, portrait: mobile && orientation === 'vertical' };
}
