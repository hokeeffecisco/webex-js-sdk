// Internal dependencies.
// Need to import metrics plugin for the devices to send metrics on succes/failure registration
import '@webex/internal-plugin-metrics';
import {registerInternalPlugin} from '@webex/webex-core';

// Plugin dependencies.
import Device from './device';
import {FeatureCollection, FeatureModel, FeaturesModel} from './features/index';
import DeviceUrlInterceptor from './interceptors/device-url';
import * as constants from './constants';
import config from './config';

registerInternalPlugin('device', Device, {
  config,
  interceptors: {
    DeviceUrlInterceptor: DeviceUrlInterceptor.create
  },
  /**
   * Unregister the device in the case that the webex instance has logged out.
   *
   * @returns {Promise<undefined>}
   */
  onBeforeLogout() {
    return this.unregister();
  }
});

export {default} from './device';
export {
  config,
  constants,
  DeviceUrlInterceptor,
  FeatureCollection,
  FeatureModel,
  FeaturesModel
};

