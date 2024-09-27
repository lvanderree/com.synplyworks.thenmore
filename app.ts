import { HomeyAPI } from "athom-api";

const Homey = require("homey");
const { HomeyAPIApp } = require("homey-api");

import Device = HomeyAPI.ManagerDevices.Device;

const DEBUG = process.env.DEBUG === "1";

interface Timer {
  id: NodeJS.Timeout;
  device: Device;
  offTime: number;
  capability: string;
  value: any;
  oldValue: any;
  onOffCapabilityInstance: any;
}

export default class TimerApp extends Homey.App {
  private timers: { [deviceId: string]: Timer } = {};

  onInit() {
    this.log(`${this.id} is running...(debug mode ${DEBUG ? "on" : "off"})`);
    if (DEBUG) {
      require("inspector").open(9229, "0.0.0.0");
    }

    this.log("Timer App is initializing...");

    // remember timeoutIds per device
    //this.timers = [];
    this.initFlowCards();

    this.log("Timer App is running...");
  }

  initFlowCards() {
    this.homey.flow
      .getActionCard("then_more_on_off")

      .registerRunListener(async (args: any) => {
        return this.runScript(args.device, { capability: "onoff", value: true }, args.time_on, args.ignore_when_on, args.overrule_longer_timeouts);
      })
      .getArgument("device")

      .registerAutocompleteListener(async (query: string, args: any) => {
        return this.getOnOffDevices().then((onOffDevices) => {
          // filter key that have a matching name
          return onOffDevices.filter((device) => {
            return device.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
          });
        });
      });

    this.homey.flow
      .getActionCard("then_more_dim")

      .registerRunListener(async (args: any) => {
        return this.runScript(args.device, { capability: "dim", value: args.brightness_level }, args.time_on, args.ignore_when_on, args.overrule_longer_timeouts, args.restore);
      })
      // TODO: DRY registerAutocompleteListener
      .getArgument("device")

      .registerAutocompleteListener(async (query: string, args: any) => {
        return this.getDimDevices().then((dimDevices) => {
          // filter devices that have a matching name
          return dimDevices.filter((device) => {
            return device.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
          });
        });
      });

    this.homey.flow
      .getActionCard("cancel_timer")

      .registerRunListener((args: any) => {
        return this.cancelTimer(args.device);
      })
      .getArgument("device")

      .registerAutocompleteListener(async (query: string) => {
        return this.getOnOffDevices().then((onOffDevices) => {
          return onOffDevices.filter((device) => {
            return device.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
          });
        });
      });

    this.homey.flow
      .getConditionCard("is_timer_running")
      .registerRunListener(async (args: any) => {
        return args.device.id in this.timers;
      })
      .getArgument("device")
      .registerAutocompleteListener(async (query: string) => {
        return this.getOnOffDevices().then((onOffDevices) => {
          return onOffDevices.filter((device) => {
            return device.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
          });
        });
      });
  }

  async runScript(device: Device, action: { capability: string; value: any }, timeOn: number, ignoreWhenOn: string, overruleLongerTimeouts: string, restore: string = "no"): Promise<boolean> {
    const api = await this.getApi();
    const apiDevice = await api.devices.getDevice({ id: device.id });
    const deviceCapability = apiDevice.capabilitiesObj[action.capability];
    const timer = this.timers[device.id];

    let oldValue: number | null = null;
    let capabilityInstance = null;

    if (deviceCapability.value === false || ignoreWhenOn === "no" || (timer && (overruleLongerTimeouts === "yes" || Date.now() + timeOn * 1000 > timer.offTime))) {
      if (timer) {
        oldValue = timer.oldValue;
        capabilityInstance = timer.onOffCapabilityInstance;
        await this.cancelTimer(device);
      } else {
        if (action.capability === "dim" && restore === "yes") {
          oldValue = deviceCapability.value as number;
          this.log(`Remembered state for ${device.name} [${device.id}] oldValue: ${oldValue}`);
        }

        await this.setDeviceCapabilityState(device, action.capability, action.value);

        capabilityInstance = apiDevice.makeCapabilityInstance(action.capability, (value: any) => {
          if (!value || value === 0) {
            this.log(`Listener: Device ${device.name} [${device.id}] turned off or dimmed to zero, disabling timer`);
            this.cancelTimer(device);
          }
        });
      }

      let logMessage = `Set timer for device ${device.name} [${device.id}] to ${timeOn} seconds`;
      if (oldValue !== null && oldValue !== undefined) {
        logMessage += `, oldValue: ${oldValue}`;
      }
      this.log(logMessage);

      const timeoutId = setTimeout(() => {
        (async () => {
          this.log(`Timeout for ${device.name} [${device.id}]`);

          const currentTimer = this.timers[device.id];
          if (currentTimer && currentTimer.id === timeoutId) {
            this.cleanupTimer(device);

            if (oldValue !== null && oldValue !== undefined) {
              await this.setDeviceCapabilityState(device, action.capability, oldValue);
            } else {
              if (action.capability === "onoff") {
                await this.setDeviceCapabilityState(device, "onoff", false);
              } else if (action.capability === "dim") {
                await this.setDeviceCapabilityState(device, "dim", 0);
              } else {
                await this.setDeviceCapabilityState(device, action.capability, false);
              }
            }
          } else {
            this.log(`Timer expired for ${device.name} [${device.id}], but it was already canceled or replaced with a new timer.`);
          }
        })().catch((error) => {
          this.log(`Error in timeout function for ${device.name} [${device.id}]: ${error}`);
        });
      }, timeOn * 1000);

      this.timers[device.id] = {
        id: timeoutId,
        device: device,
        offTime: Date.now() + timeOn * 1000,
        capability: action.capability,
        value: action.value,
        oldValue: oldValue,
        onOffCapabilityInstance: capabilityInstance
      };

      this.homey.api.realtime("timer_started", {
        timers: this.exportTimers(),
        device: device,
        capability: action.capability,
        value: action.value,
        oldValue: oldValue
      });
    }

    return true;
  }

  async cancelTimer(device: Device) {
    const timer = this.timers[device.id];
    // if timer is running cancel timer and remove reference
    if (timer) {
      clearTimeout(timer.id);
      this.log(`Cancelled timer for device ${device.name} [${device.id}]`);
      this.cleanupTimer(device);
    } else {
      this.log(`WARNING: No timer to Cancel for device ${device.name} [${device.id}]`);
    }

    return Promise.resolve(true);
  }

  cleanupTimer(device: Device): void {
    const timer = this.timers[device.id];
    if (timer) {
      // clean up listener for off-state
      timer.onOffCapabilityInstance.destroy();
      // remove reference of timer for this device
      delete this.timers[device.id];
      // emit event to signal settings page the timer can be removed
      this.homey.api.realtime("timer_deleted", {
        timers: this.exportTimers(),
        device: device
      });
    } else {
      this.log(`WARNING: No timer to cleanup for device ${device.name} [${device.id}]`);
    }
  }

  // set a device to a certain state
  async setDeviceCapabilityState(device: Device, capabilityId: string, value: any) {
    this.log(`set device ${device.name} [${device.id}] capability ${capabilityId} to ${value}`);
    try {
      const api = await this.getApi();
      await api.devices.setCapabilityValue({
        deviceId: device.id,
        capabilityId: capabilityId,
        value: value
      });
      // update cache of apiDevice.capabilitiesObj
      const apiDevice = await api.devices.getDevice({ id: device.id });
      apiDevice.capabilitiesObj[capabilityId].value = value;
    } catch (error) {
      this.log(`Error setting capability value: ${error}`);
    }
  }

  // Get API control function
  getApi(): typeof HomeyAPIApp {
    if (!this.api) {
      this.api = new HomeyAPIApp({
        homey: this.homey
      });
    }
    return this.api;
  }

  // Get Timers
  exportTimers() {
    let data: any = {};
    // clone timers, and remove the timeout-id
    for (let key in this.timers) {
      data[key] = Object.assign({}, this.timers[key]);
      delete data[key].id; // remove timeout id which cannot be exported
    }
    return data;
  }

  // Get all devices function for API
  async getAllDevices(): Promise<Device[]> {
    const api = await this.getApi();
    const devices = await api.devices.getDevices();
    if (!devices) {
      return [];
    }
    return Object.values(devices);
  }

  /**
   * load all devices from Homey
   * and filter all without on/off capability
   */
  async getOnOffDevices(): Promise<Device[]> {
    return (await this.getAllDevices()).filter((device: Device) => {
      return (
        device.capabilitiesObj !== null &&
        "onoff" in device.capabilitiesObj &&
        // @ts-ignore
        device.capabilitiesObj.onoff.setable
      );
    });
  }

  /**
   * load all devices from Homey
   * and filter all without dim capability
   */
  async getDimDevices(): Promise<Device[]> {
    return (await this.getAllDevices()).filter((device) => {
      return (
        device.capabilitiesObj !== null &&
        "dim" in device.capabilitiesObj &&
        // @ts-ignore
        device.capabilitiesObj.dim.setable
      );
    });
  }
}

module.exports = TimerApp;
