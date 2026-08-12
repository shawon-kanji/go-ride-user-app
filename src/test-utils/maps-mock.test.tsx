import { fireEvent, render, screen } from '@testing-library/react-native';

import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

describe('react-native-maps manual mock', () => {
  it('renders MapView and forwards initialRegion props for readback', async () => {
    await render(
      <MapView
        testID="map"
        initialRegion={{ latitude: 1, longitude: 2, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
      />
    );

    const map = screen.getByTestId('map');
    expect(map).toBeTruthy();
    expect(map.props.initialRegion.latitude).toBe(1);
  });

  it('renders a child Marker and forwards its coordinate props', async () => {
    await render(
      <MapView testID="map">
        <Marker testID="pin" coordinate={{ latitude: 3, longitude: 4 }} />
      </MapView>
    );

    const pin = screen.getByTestId('pin');
    expect(pin).toBeTruthy();
    expect(pin.props.coordinate.longitude).toBe(4);
  });

  it('dispatches onPress via fireEvent with the nativeEvent coordinate', async () => {
    const onPress = jest.fn();
    await render(<MapView testID="map" onPress={onPress} />);

    await fireEvent(screen.getByTestId('map'), 'press', {
      nativeEvent: { coordinate: { latitude: 5, longitude: 6 } },
    });

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress.mock.calls[0][0].nativeEvent.coordinate.latitude).toBe(5);
  });

  it('exports PROVIDER_GOOGLE as a non-empty named export', () => {
    expect(PROVIDER_GOOGLE).toBeTruthy();
  });
});
