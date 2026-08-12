/**
 * Manual Jest mock for react-native-maps.
 *
 * jest-expo only auto-mocks first-party Expo SDK native modules; react-native-maps is a
 * third-party native UI library it has zero knowledge of, so any test rendering a tree
 * containing <MapView> fails resolving AIRMap/RNMapsMapView without this file.
 * See .planning/phases/02-fare-estimate-booking/02-RESEARCH.md Pitfall 6.
 *
 * Both stand-ins forward EVERY prop onto a plain RN <View>, so tests can read back
 * initialRegion/coordinate via `screen.getByTestId(...).props.*` and can trigger the
 * map's onPress directly with fireEvent instead of simulating native gestures.
 */
const React = require('react');
const { View } = require('react-native');

function MapView(props) {
  return React.createElement(View, props, props.children);
}

function Marker(props) {
  return React.createElement(View, props, props.children);
}

function Polyline(props) {
  return React.createElement(View, props, props.children);
}

module.exports = {
  __esModule: true,
  default: MapView,
  MapView,
  Marker,
  Polyline,
  PROVIDER_GOOGLE: 'google',
  PROVIDER_DEFAULT: undefined,
};
