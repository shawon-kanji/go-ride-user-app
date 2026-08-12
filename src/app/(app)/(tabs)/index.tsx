import { MapSmokeTest } from '../../../features/booking/components/MapSmokeTest';

// TEMPORARY (plan 02-02): the Home tab renders the Wave 0 native smoke screen so it is
// reachable on device without adding a throwaway route. Plan 02-07 replaces this with
// the real "Book a ride" entry point.
export default function HomeScreen() {
  return <MapSmokeTest />;
}
